import type { AnimationScene, Diagnostic, XmlElement } from './types.ts'

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
export function numeric(raw: string): number | null {
  const trimmed = raw.trim()
  if (!NUMBER.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

export class Validation {
  warnings: Diagnostic[] = []
  errors: Diagnostic[] = []

  error(code: string, message: string, node: XmlElement, attribute?: string) {
    this.errors.push({ code, message, source: node.source, attribute })
  }

  warn(code: string, message: string, node: XmlElement, attribute?: string) {
    this.warnings.push({ code, message, source: node.source, attribute })
  }

  number(node: XmlElement, attribute: string, required = false): number | undefined {
    const raw = node.attributes[attribute]
    if (raw === undefined) {
      if (required) this.error('MISSING_NUMBER', `Missing ${attribute}`, node, attribute)
      return undefined
    }
    const value = numeric(raw)
    if (value === null) this.error('MALFORMED_NUMBER', `Invalid ${attribute}: ${raw}`, node, attribute)
    return value ?? undefined
  }

  boolean(node: XmlElement, attribute: string): boolean | undefined {
    const value = node.attributes[attribute]
    if (value === undefined) return undefined
    if (value === 'true') return true
    if (value === 'false') return false
    this.error('MALFORMED_BOOLEAN', `Invalid ${attribute}: ${value}`, node, attribute)
    return undefined
  }
}

/** Current validation convention: scene-local parents and document-unique scene IDs.
 * The first fixture does not establish these as universal format rules.
 * Repeated effect IDs identify effect types, not instances. */
export function validateRelationships(root: AnimationScene, validation: Validation) {
  const sceneIds = new Set<string>()
  const visit = (scene: AnimationScene) => {
    if (scene.id !== undefined) {
      if (sceneIds.has(scene.id)) validation.error('DUPLICATE_SCENE_ID', `Duplicate scene ID ${scene.id}`, scene.raw)
      sceneIds.add(scene.id)
    }
    const ids = new Map<string, typeof scene.layers>()
    for (const layer of scene.layers) {
      if (layer.id === undefined) continue
      const matches = ids.get(layer.id) ?? []
      if (matches.length) validation.error('DUPLICATE_LAYER_ID', `Duplicate layer ID ${layer.id} in scene`, layer.raw)
      matches.push(layer)
      ids.set(layer.id, matches)
    }
    for (const layer of scene.layers) {
      if (layer.parentId !== undefined) {
        const matches = ids.get(layer.parentId)
        if (!matches) validation.error('UNRESOLVED_PARENT', `Parent ${layer.parentId} is not in this scene`, layer.raw, 'parent')
        else if (matches.length > 1) validation.error('AMBIGUOUS_PARENT', `Parent ${layer.parentId} is duplicated`, layer.raw, 'parent')
        const seen = new Set([layer.source.path])
        let current = layer
        while (current.parentId !== undefined) {
          const parents = ids.get(current.parentId)
          if (parents?.length !== 1) break
          current = parents[0]
          if (seen.has(current.source.path)) {
            validation.error('PARENT_CYCLE', 'Cyclic layer parenting', layer.raw, 'parent')
            break
          }
          seen.add(current.source.path)
        }
      }
      for (const child of layer.scenes) visit(child)
    }
    for (const child of scene.scenes) visit(child)
  }
  visit(root)
}

export function validateStructure(root: XmlElement, validation: Validation) {
  const visit = (node: XmlElement, parent?: XmlElement) => {
    if (node.source.element === 'scene' && parent && !['scene', 'embedScene'].includes(parent.source.element)) {
      validation.error('INVALID_NESTED_SCENE', 'Scene must be directly inside a scene or embedScene', node)
    }
    if (node.source.element === 'embedScene') {
      const scenes = node.children.filter(child => child.source.element === 'scene')
      if (scenes.length !== 1) validation.error('INVALID_EMBEDDED_SCENE', 'embedScene must contain exactly one scene', node)
    }
    for (const child of node.children) visit(child, node)
  }
  visit(root)
}

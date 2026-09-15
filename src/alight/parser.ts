import { readXml } from './xml.ts'
import { numeric, Validation, validateRelationships, validateStructure } from './validation.ts'
import type {
  AlightParseResult, AnimationEasing, AnimationEffect, AnimationKeyframe, AnimationLayer,
  AnimationProperty, AnimationScene, AnimationValue, XmlElement,
} from './types.ts'

const sourced = (raw: XmlElement) => ({ source: raw.source, raw })
const tag = (node: XmlElement) => node.source.element
const TRANSFORM_TYPES: Record<string, string> = {
  location: 'vector', scale: 'vector', pivot: 'vector', rotation: 'float', opacity: 'float',
}
const LAYER_PROPERTIES: Record<string, string> = { fillColor: 'color', gain: 'float' }
const VALUE_TYPES = new Set(['bool', 'int', 'float', 'vec2', 'vec3', 'vector', 'color'])

class AlightNormalizer {
  validation = new Validation()

  value(node: XmlElement, type: string, attribute: string): AnimationValue {
    const raw = node.attributes[attribute]
    const result: AnimationValue = { source: node.source, type, raw, value: raw ?? null }
    if (raw === undefined) {
      this.validation.error('MISSING_VALUE', `Missing ${attribute}`, node, attribute)
      return result
    }
    if (type === 'bool') result.value = this.validation.boolean(node, attribute) ?? null
    else if (type === 'int' || type === 'float') {
      result.value = this.validation.number(node, attribute) ?? null
      if (type === 'int' && typeof result.value === 'number' && !Number.isInteger(result.value)) {
        this.validation.error('MALFORMED_INTEGER', `Expected integer, got ${raw}`, node, attribute)
        result.value = null
      } else if (type === 'int' && typeof result.value === 'number' && !Number.isSafeInteger(result.value)) {
        this.validation.warn('UNSAFE_INTEGER', 'Integer exceeds exact JS representation; use raw value', node, attribute)
      }
    } else if (['vec2', 'vec3', 'vector'].includes(type)) {
      const parts = raw.split(',').map(numeric)
      const expected = type === 'vec2' ? [2] : type === 'vec3' ? [3] : [2, 3]
      if (!expected.includes(parts.length) || parts.some(part => part === null)) {
        this.validation.error('MALFORMED_VECTOR', `Invalid ${type}: ${raw}`, node, attribute)
        result.value = null
      } else result.value = parts as number[]
    }
    // Colors and unsupported value types remain strings, with no color-space conversion.
    return result
  }

  easing(node: XmlElement): AnimationEasing | undefined {
    const raw = node.attributes.e
    if (raw === undefined) return undefined
    const [name = '', ...rawParameters] = raw.trim().split(/\s+/)
    const kind = name === 'cubicBezier' || name === 'elastic' ? name : 'unknown'
    const parameters = rawParameters.map(numeric)
    if (kind === 'unknown') {
      if (!name) this.validation.error('MALFORMED_EASING', 'Empty easing definition', node, 'e')
      else this.validation.warn('UNKNOWN_EASING', `Retained unsupported easing ${name}`, node, 'e')
    } else if (parameters.length !== 4 || parameters.some(value => value === null)) {
      this.validation.error('MALFORMED_EASING', `${name} requires four finite numeric parameters`, node, 'e')
    }
    return { source: node.source, kind, name, raw, rawParameters, parameters }
  }

  property(node: XmlElement, implicitType?: string): AnimationProperty {
    const name = node.attributes.name ?? tag(node)
    const type = node.attributes.type ?? implicitType ?? 'unknown'
    if (tag(node) === 'property' && !node.attributes.name) this.validation.error('MISSING_PROPERTY_NAME', 'Property has no name', node)
    if (!VALUE_TYPES.has(type)) this.validation.warn('UNKNOWN_PROPERTY_TYPE', `Retained property type ${type}`, node, 'type')
    const keyframes: AnimationKeyframe[] = node.children.filter(child => tag(child) === 'kf').map(child => {
      const sourceValue = this.validation.number(child, 't', true) ?? null
      if (child.attributes.t === undefined || child.attributes.v === undefined) {
        this.validation.error('MALFORMED_KEYFRAME', 'Keyframe requires both t and v attributes', child)
      }
      if (child.children.length) this.validation.warn('UNKNOWN_KEYFRAME_CONTENT', 'Retained child elements on keyframe', child)
      return {
        ...sourced(child), timing: { sourceT: child.attributes.t, sourceValue },
        value: this.value(child, type, 'v'), easing: this.easing(child), propertyPath: node.source.path,
      }
    })
    const unknownElements = node.children.filter(child => tag(child) !== 'kf')
    for (const child of unknownElements) this.validation.warn('UNKNOWN_PROPERTY_CONTENT', 'Retained unrecognized property content', child)
    if (!keyframes.length && node.attributes.value === undefined && !unknownElements.length) {
      this.validation.error('EMPTY_PROPERTY', 'Property has neither static value nor keyframes', node)
    }
    return {
      ...sourced(node), name, type,
      staticValue: node.attributes.value === undefined ? undefined : this.value(node, type, 'value'),
      keyframes, unknownElements,
    }
  }

  effect(node: XmlElement): AnimationEffect {
    if (!node.attributes.id) this.validation.error('MISSING_EFFECT_ID', 'Effect has no ID', node)
    const properties = node.children.filter(child => tag(child) === 'property').map(child => this.property(child))
    const unknownElements = node.children.filter(child => tag(child) !== 'property')
    for (const child of unknownElements) this.validation.warn('UNKNOWN_EFFECT_CONTENT', 'Retained unrecognized effect content', child)
    return {
      ...sourced(node), id: node.attributes.id,
      locallyApplied: this.validation.boolean(node, 'locallyApplied'), properties, unknownElements,
    }
  }

  layer(node: XmlElement, scene: XmlElement): AnimationLayer {
    const a = node.attributes
    const timing = {
      ...sourced(node),
      startTime: this.validation.number(node, 'startTime', true),
      endTime: this.validation.number(node, 'endTime', true),
      inTime: this.validation.number(node, 'inTime'),
      outTime: this.validation.number(node, 'outTime'),
      speed: this.validation.number(node, 'speed'),
    }
    if (timing.startTime !== undefined && timing.endTime !== undefined && timing.endTime < timing.startTime) {
      this.validation.error('INVALID_LAYER_TIMING', 'endTime precedes startTime', node)
    }
    if (timing.inTime !== undefined && timing.outTime !== undefined && timing.outTime < timing.inTime) {
      this.validation.warn('REVERSED_MEDIA_RANGE', 'outTime precedes inTime; possible reverse playback, retained unchanged', node)
    }
    const kind = tag(node) === 'nullobj' ? 'null' : tag(node) === 'embedScene' ? 'embedded'
      : tag(node) === 'shape' ? a.fillType === 'media' ? 'media' : 'shape' : 'unknown'
    if (kind === 'unknown') this.validation.warn('UNKNOWN_LAYER', `Retained layer element ${tag(node)}`, node)
    const properties: AnimationProperty[] = []
    const transforms: AnimationLayer['transforms'] = []
    const effects: AnimationEffect[] = []
    const scenes: AnimationScene[] = []
    const unknownElements: XmlElement[] = []
    for (const child of node.children) {
      switch (tag(child)) {
        case 'transform':
          transforms.push({ ...sourced(child), properties: child.children.map(property => this.property(property, Object.hasOwn(TRANSFORM_TYPES, tag(property)) ? TRANSFORM_TYPES[tag(property)] : undefined)) })
          break
        case 'effect': effects.push(this.effect(child)); break
        case 'scene': scenes.push(this.scene(child, scene, node)); break
        case 'property': properties.push(this.property(child)); break
        default:
          if (Object.hasOwn(LAYER_PROPERTIES, tag(child))) properties.push(this.property(child, LAYER_PROPERTIES[tag(child)]))
          else {
            unknownElements.push(child)
            this.validation.warn('UNKNOWN_LAYER_CONTENT', 'Retained unrecognized layer content', child)
          }
      }
    }
    return {
      ...sourced(node), kind, id: a.id, label: a.label,
      hidden: this.validation.boolean(node, 'hidden'), scenePath: scene.source.path, parentId: a.parent,
      timing, fillType: a.fillType,
      media: Object.fromEntries(Object.entries(a).filter(([key]) => /^(fillVideo|fillImage|fillAudio|media)/.test(key))),
      shapeType: a.s, blending: a.blending,
      maskGroupAttributes: Object.fromEntries(Object.entries(a).filter(([key]) => /mask|group/i.test(key))),
      transforms, properties, effects, scenes, unknownElements,
    }
  }

  scene(node: XmlElement, parent?: XmlElement, owner?: XmlElement): AnimationScene {
    const dimensions = {
      width: this.validation.number(node, 'width'), height: this.validation.number(node, 'height'),
      exportWidth: this.validation.number(node, 'exportWidth'), exportHeight: this.validation.number(node, 'exportHeight'),
      fps: this.validation.number(node, 'fps'), totalTime: this.validation.number(node, 'totalTime'),
    }
    for (const [key, value] of Object.entries(dimensions)) {
      if (value !== undefined && (key === 'totalTime' ? value < 0 : value <= 0)) {
        this.validation.error('INVALID_SCENE_METRIC', `Invalid ${key}: ${value}`, node, key)
      }
    }
    const layers: AnimationLayer[] = []
    const scenes: AnimationScene[] = []
    const bookmarks: AnimationScene['bookmarks'] = []
    const unknownElements: XmlElement[] = []
    for (const child of node.children) {
      const name = tag(child)
      if (name === 'bookmark') bookmarks.push({ ...sourced(child), rawTime: child.attributes.t, time: this.validation.number(child, 't', true) ?? null })
      else if (name === 'scene') scenes.push(this.scene(child, node))
      else if (['shape', 'nullobj', 'embedScene'].includes(name) || 'startTime' in child.attributes || 'endTime' in child.attributes) layers.push(this.layer(child, node))
      else {
        unknownElements.push(child)
        this.validation.warn('UNKNOWN_SCENE_CONTENT', 'Retained unrecognized scene content', child)
      }
    }
    return {
      ...sourced(node), id: node.attributes.id, title: node.attributes.title, ...dimensions,
      metadata: Object.fromEntries(Object.entries(node.attributes).filter(([key]) => !['id', 'title', ...Object.keys(dimensions)].includes(key))),
      parentScenePath: parent?.source.path, ownerLayerPath: owner?.source.path, ownerLayerId: owner?.attributes.id,
      bookmarks, layers, scenes, unknownElements,
    }
  }
}

/** Pure XML → Animation IR. Never evaluates effects, easing, motion, or media. */
export function parseAlightXml(xml: string): AlightParseResult {
  let root: XmlElement
  try { root = readXml(xml) }
  catch (error) {
    return { project: null, warnings: [], errors: [{ code: 'INVALID_XML', message: error instanceof Error ? error.message : String(error) }] }
  }
  if (tag(root) !== 'scene') {
    return { project: null, warnings: [], errors: [{ code: 'INVALID_ROOT', message: 'Expected an Alight scene root', source: root.source }] }
  }
  const parser = new AlightNormalizer()
  validateStructure(root, parser.validation)
  const project = { ...parser.scene(root), sourceXml: xml }
  validateRelationships(project, parser.validation)
  return { project, warnings: parser.validation.warnings, errors: parser.validation.errors }
}

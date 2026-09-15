import type { AnimationLayer, AnimationProject, AnimationScene, SourceRef, XmlElement } from './types.ts'
import type { ResolvedTimeline, TimeInterval, TimeValue, TimingPolicy } from './timing-types.ts'
import { Validation, validateRelationships, validateStructure } from './validation.ts'

export const CONSERVATIVE_TIMING: TimingPolicy = {
  id: 'source-only', keyframeBasis: 'unresolved', embeddedMapping: 'unresolved',
}

/** Opt-in hypothesis supported by identity embeds in the first fixture, not a format law. */
export const LAYER_RELATIVE_TIMING: TimingPolicy = {
  id: 'layer-relative-v1', keyframeBasis: 'layer-duration', embeddedMapping: 'affine',
  omittedSpeed: 1, omittedInTime: 0,
}

const unknown = (reason: string): TimeValue => ({ value: null, resolution: 'unresolved', basis: 'derived', rule: 'unresolved', reason })
const time = (value: number | undefined | null, rule: string, basis: 'source' | 'derived' = 'derived'): TimeValue =>
  value === undefined || value === null || !Number.isFinite(value) ? unknown('Missing, malformed, or non-finite timing')
    : { value, resolution: 'exact', basis, rule }
const interval = (start: TimeValue, end: TimeValue): TimeInterval => ({ start, end })
const blockedInterval = (reason: string): TimeInterval => interval(unknown(reason), unknown(reason))
const properties = (layer: AnimationLayer) => [
  ...layer.properties, ...layer.transforms.flatMap(transform => transform.properties),
  ...layer.effects.flatMap(effect => effect.properties),
]
const duration = (layer: AnimationLayer) => {
  const { startTime, endTime } = layer.timing
  return startTime !== undefined && endTime !== undefined && Number.isFinite(startTime) && Number.isFinite(endTime) && endTime >= startTime
    ? endTime - startTime : null
}

const KNOWN_TIMING_ATTRIBUTES = new Set(['startTime', 'endTime', 'inTime', 'outTime', 'speed', 'retime', 'retimeAdaptFPS', 'modifiedTime', 'totalTime'])
const hasUnknownTiming = (node: XmlElement) => Object.keys(node.attributes).some(key => /time|speed|progress/i.test(key) && !KNOWN_TIMING_ATTRIBUTES.has(key))

type Clock = (localMs: number) => TimeValue
interface ContentMapping { range: TimeInterval; mapToParent: Clock }

/** Pure coordinate conversion. It never mutates the IR, evaluates motion, or clips a keyframe. */
export function resolveTimeline(project: AnimationProject, policy: TimingPolicy = CONSERVATIVE_TIMING): ResolvedTimeline {
  const result: ResolvedTimeline = { policy: { ...policy }, evidence: 'xml-only', scenes: [], layers: [], keyframes: [], diagnostics: [] }
  const diagnostic = (code: string, message: string, source?: SourceRef) => result.diagnostics.push({ code, message, source })
  const validation = new Validation()
  validateStructure(project.raw, validation)
  validateRelationships(project, validation)
  const structuralProblem = validation.errors.length > 0
  if (structuralProblem) diagnostic('INVALID_TIMELINE_STRUCTURE', 'Reference/scene errors prevent project-time conversion', project.source)
  if (policy.keyframeBasis !== 'unresolved' || policy.embeddedMapping !== 'unresolved') {
    diagnostic('TIMING_POLICY_NOT_RENDER_VERIFIED', 'Exact values are conditional on the explicit policy; XML evidence alone does not verify rendered timing', project.source)
  }

  const contentMapping = (layer: AnimationLayer, child?: AnimationScene): ContentMapping => {
    const fail = (reason: string): ContentMapping => ({ range: blockedInterval(reason), mapToParent: () => unknown(reason) })
    if (policy.embeddedMapping !== 'affine') return fail('No content-time mapping policy selected')
    const span = duration(layer)
    if (span === null || span === 0) return fail('Missing, invalid, or zero layer duration')
    const { startTime, speed: explicitSpeed, inTime: explicitIn, outTime } = layer.timing
    // A malformed explicit attribute must never fall back to an omitted-attribute convention.
    if (['speed', 'inTime', 'outTime'].some(key => Object.hasOwn(layer.raw.attributes, key) && layer.timing[key as 'speed' | 'inTime' | 'outTime'] === undefined)) return fail('Malformed explicit content timing')
    const speed = explicitSpeed ?? policy.omittedSpeed
    const inTime = explicitIn ?? policy.omittedInTime
    if (speed === undefined || inTime === undefined) return fail('Missing speed/inTime without an explicit omission convention')
    if (!Number.isFinite(speed) || speed <= 0 || !Number.isFinite(inTime) || inTime < 0) return fail('Reverse, zero, negative, or invalid content timing is unsupported')
    if (child && ['speed', 'inTime', 'outTime', 'startTime', 'endTime'].some(key => Object.hasOwn(child.raw.attributes, key))) return fail('Scene-level playback timing is unsupported; only owner-layer playback timing is mapped')
    if (layer.raw.attributes.retime !== undefined && layer.raw.attributes.retime !== 'off') return fail(`Unsupported owner retime: ${layer.raw.attributes.retime}`)
    const retime = child?.metadata.retime ?? layer.raw.attributes.retime
    if (retime !== 'off' && !(retime === undefined && policy.allowOmittedRetime)) return fail(`Unsupported or unspecified content retime: ${retime ?? 'missing'}`)
    if (child?.metadata.retimeAdaptFPS === 'true' || layer.raw.attributes.retimeAdaptFPS === 'true') return fail('FPS-adaptive retiming is unsupported')
    if ([layer.raw, ...(child ? [child.raw] : [])].some(hasUnknownTiming)) return fail('Unrecognized timing attribute')
    if (layer.unknownElements.length || child?.unknownElements.length) return fail('Unrecognized content may affect timing')
    const computedOut = inTime + span * speed
    if (!Number.isFinite(computedOut)) return fail('Content arithmetic overflow')
    // No frame-sized tolerance or reconciliation: exported rounding semantics are unverified.
    if (outTime !== undefined && Math.abs(outTime - computedOut) > Number.EPSILON * Math.max(1, Math.abs(outTime), Math.abs(computedOut)) * 8) return fail('inTime/outTime/speed disagree with the layer span')
    const end = outTime ?? computedOut
    if (child && (child.totalTime === undefined || !Number.isFinite(child.totalTime) || inTime > child.totalTime || end > child.totalTime)) return fail('Content range is outside or lacks the nested scene duration')
    return {
      range: interval(time(inTime, explicitIn === undefined ? 'policy omittedInTime' : 'inTime', explicitIn === undefined ? 'derived' : 'source'), time(end, outTime === undefined ? 'inTime + layerSpan * speed' : 'outTime', outTime === undefined ? 'derived' : 'source')),
      mapToParent: localMs => localMs < inTime || localMs > end
        ? unknown('Coordinate is outside the embedded content interval; no extrapolation/retiming guessed')
        : time(startTime! + (localMs - inTime) / speed, 'layer.startTime + (sceneLocalMs - inTime) / speed'),
    }
  }

  const visit = (scene: AnimationScene, clock: Clock) => {
    const sceneEnd = time(scene.totalTime, 'scene.totalTime', 'source')
    result.scenes.push({ source: scene.source, ownerLayerPath: scene.ownerLayerPath,
      localInterval: interval(time(0, 'scene-local origin'), sceneEnd),
      projectInterval: interval(clock(0), sceneEnd.value === null ? unknown('Missing scene duration') : clock(sceneEnd.value)),
    })
    for (const layer of scene.layers) {
      const span = duration(layer)
      const sceneInterval = span === null ? blockedInterval('Invalid layer interval')
        : interval(time(layer.timing.startTime, 'startTime', 'source'), time(layer.timing.endTime, 'endTime', 'source'))
      const toProject = (value: TimeValue) => value.value === null ? unknown('Invalid layer interval') : clock(value.value)
      const projectInterval = interval(toProject(sceneInterval.start), toProject(sceneInterval.end))
      let content: ContentMapping | undefined
      if (layer.kind === 'embedded' || layer.kind === 'media') {
        content = contentMapping(layer, layer.scenes.length === 1 ? layer.scenes[0] : undefined)
        if (content.range.start.resolution === 'unresolved') diagnostic('UNRESOLVED_CONTENT_TIMING', content.range.start.reason!, layer.source)
      }
      result.layers.push({ source: layer.source, scenePath: scene.source.path, parentId: layer.parentId, sceneInterval, projectInterval, contentInterval: content?.range ?? null })
      let warned = false
      for (const property of properties(layer)) for (const keyframe of property.keyframes) {
        const { sourceT, sourceValue } = keyframe.timing
        const retimed = (layer.timing.speed !== undefined && layer.timing.speed !== 1) || (Object.hasOwn(layer.raw.attributes, 'speed') && layer.timing.speed === undefined)
        const unknownTiming = (Object.hasOwn(layer.raw.attributes, 'speed') && layer.timing.speed === undefined) || (layer.raw.attributes.retime !== undefined && layer.raw.attributes.retime !== 'off') || [layer.raw, property.raw, keyframe.raw, scene.raw].some(hasUnknownTiming) || layer.kind === 'unknown' || property.unknownElements.length > 0 || layer.effects.some(effect => effect.properties.includes(property) && hasUnknownTiming(effect.raw))
        const supported = !unknownTiming && policy.keyframeBasis === 'layer-duration' && (!retimed || policy.retimedProperties === 'layer-duration')
        const reason = unknownTiming ? 'Unrecognized timing metadata or property content' : !supported ? retimed ? 'Property coordinate basis on a speed-modified layer is unverified' : 'Keyframe coordinate basis is unspecified' : 'Invalid keyframe coordinate or layer duration'
        const progress = supported && sourceValue !== null ? time(sourceValue, 'policy: kf.t is layer-relative progress') : unknown(reason)
        const local = progress.value !== null && span !== null && span > 0 ? time(progress.value * span, 'localProgress * (endTime - startTime)') : unknown(reason)
        const inScene = local.value !== null ? time(layer.timing.startTime! + local.value, 'startTime + localTimeMs') : unknown(reason)
        const absolute = inScene.value !== null ? clock(inScene.value) : unknown(reason)
        const within = local.value === null || span === null ? null : local.value >= 0 && local.value <= span
        result.keyframes.push({ source: keyframe.source, layerPath: layer.source.path, scenePath: scene.source.path, propertyPath: property.source.path,
          sourceT, sourceValue, localProgress: progress, localTimeMs: local, sceneTimeMs: inScene, projectTimeMs: absolute,
          resolution: absolute.resolution, classification: sourceValue === null ? 'malformed' : within === null ? 'unresolved' : within ? 'within-layer' : 'outside-layer', withinLayerInterval: within,
        })
        if (absolute.resolution === 'unresolved' && !warned) {
          diagnostic('UNRESOLVED_PROPERTY_TIMING', absolute.reason ?? reason, layer.source)
          warned = true
        }
      }
      for (const child of layer.scenes) {
        const mapping = content ?? contentMapping(layer, child)
        visit(child, local => {
          if (structuralProblem) return unknown('Invalid scene/reference structure')
          const parent = mapping.mapToParent(local)
          return parent.value === null ? parent : clock(parent.value)
        })
      }
    }
    for (const child of scene.scenes) {
      diagnostic('UNPLACED_SCENE', 'Direct scene declaration has no placement layer', child.source)
      visit(child, () => unknown('No placement relationship for direct nested scene'))
    }
  }
  visit(project, local => {
    if (structuralProblem) return unknown('Invalid scene/reference structure')
    if (['speed', 'inTime', 'outTime', 'startTime', 'endTime'].some(key => Object.hasOwn(project.raw.attributes, key))) return unknown('Unsupported root playback timing')
    if (hasUnknownTiming(project.raw)) return unknown('Unrecognized root timing metadata')
    if (project.totalTime === undefined || !Number.isFinite(project.totalTime) || project.totalTime < 0) return unknown('Missing or invalid project duration')
    if (local < 0 || local > project.totalTime) return unknown('Coordinate outside project interval; export boundary behavior unresolved')
    return time(local, 'root scene time is project time (milliseconds convention)')
  })
  return result
}

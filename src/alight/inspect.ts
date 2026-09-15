import type { AnimationLayer, AnimationProject, AnimationScene } from './types.ts'

/** Read-only inventory, not an evaluation or training export. */
export function inspectProject(project: AnimationProject) {
  const layerCounts: Record<string, number> = {}
  const effectUsage: Record<string, number> = {}
  const parentRelationships: { scenePath: string; layerId?: string; layerPath: string; parentId: string }[] = []
  let sceneCount = 0
  let keyframeCount = 0
  let layerCount = 0
  const visitLayer = (layer: AnimationLayer) => {
    layerCount++
    layerCounts[layer.kind] = (layerCounts[layer.kind] ?? 0) + 1
    if (layer.parentId !== undefined) parentRelationships.push({ scenePath: layer.scenePath, layerId: layer.id, layerPath: layer.source.path, parentId: layer.parentId })
    const properties = [...layer.properties, ...layer.transforms.flatMap(transform => transform.properties), ...layer.effects.flatMap(effect => effect.properties)]
    keyframeCount += properties.reduce((count, property) => count + property.keyframes.length, 0)
    for (const effect of layer.effects) {
      const id = effect.id ?? '(missing ID)'
      // Define own properties safely even for unknown IDs such as __proto__.
      const count = Object.hasOwn(effectUsage, id) ? effectUsage[id] : 0
      Object.defineProperty(effectUsage, id, { value: count + 1, enumerable: true, configurable: true, writable: true })
    }
    layer.scenes.forEach(visitScene)
  }
  const visitScene = (scene: AnimationScene) => {
    sceneCount++
    scene.layers.forEach(visitLayer)
    scene.scenes.forEach(visitScene)
  }
  visitScene(project)
  return {
    metadata: {
      title: project.title, width: project.width, height: project.height,
      exportWidth: project.exportWidth, exportHeight: project.exportHeight,
      fps: project.fps, totalTime: project.totalTime, ...project.metadata,
    },
    layerCount, layerCounts, nestedSceneCount: sceneCount - 1,
    nullCount: layerCounts.null ?? 0, effectUsage, keyframeCount, parentRelationships,
  }
}

/** Timing inventory is separate from parser validity and carries its interpretation policy. */
export function inspectTimeline(timeline: import('./timing-types.ts').ResolvedTimeline) {
  const sourceCoordinates = new Map<string, number>()
  for (const frame of timeline.keyframes) {
    const key = frame.sourceT ?? '(missing)'
    sourceCoordinates.set(key, (sourceCoordinates.get(key) ?? 0) + 1)
  }
  return {
    policy: timeline.policy,
    evidence: timeline.evidence,
    exactKeyframeCount: timeline.keyframes.filter(frame => frame.resolution === 'exact').length,
    unresolvedKeyframeCount: timeline.keyframes.filter(frame => frame.resolution === 'unresolved').length,
    outsideLayerCount: timeline.keyframes.filter(frame => frame.classification === 'outside-layer').length,
    sourceCoordinates: [...sourceCoordinates].map(([sourceT, count]) => ({ sourceT, count })),
    sceneIntervals: timeline.scenes,
    diagnostics: timeline.diagnostics,
  }
}

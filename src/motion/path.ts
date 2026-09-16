import type { MotionSample, SpatialPath } from './types'

// Only the reconstruction guide uses this tolerance; raw trajectory and timing
// retain every sample. No angle, speed or pause thresholds create keyframes.
export const LINEAR_PATH_TOLERANCE = 2

export function computeCumulativePathDistance(samples: MotionSample[]): number[] {
  const distances = samples.length ? [0] : []
  for (let i = 1; i < samples.length; i++) {
    distances.push(distances[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y))
  }
  return distances
}

export function extractSpatialPath(samples: MotionSample[]): SpatialPath {
  const distances = computeCumulativePathDistance(samples)
  const totalLength = distances.at(-1) ?? 0
  const points = samples.map(({ x, y }) => ({ x, y }))
  if (!totalLength) return { points, totalLength, reconstruction: 'stationary' }
  const first = points[0]
  const last = points.at(-1)!
  const dx = last.x - first.x
  const dy = last.y - first.y
  const length = Math.hypot(dx, dy)
  // Compare to the straight path at the same arc-length progress. This also
  // catches reversals and closed loops whose endpoints alone lose the motion.
  const linear = points.every((point, i) => {
    const progress = distances[i] / totalLength
    return Math.hypot(point.x - first.x - dx * progress, point.y - first.y - dy * progress) <= LINEAR_PATH_TOLERANCE
  })
  return { points, totalLength, reconstruction: length > 0 && linear ? 'linear' : 'move-along-path' }
}

/** A vector path supports any captured polyline, including corners and loops.
 * Its vertices are spatial controls, never additional timed position keys.
 */
export function determineRequiredPositionKeyframes(path: SpatialPath): number[] {
  return path.points.length >= 2 && path.reconstruction !== 'stationary' ? [0, path.points.length - 1] : []
}

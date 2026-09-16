import type { MotionSample } from './types'

export const CORNER_WINDOW_PIXELS = 12
export const CORNER_MIN_LEG_PIXELS = 8
export const CORNER_ANGLE_DEGREES = 60
const CORNER_JITTER_PIXELS = 2
const distance = (a: MotionSample, b: MotionSample) => Math.hypot(b.x - a.x, b.y - a.y)

/** Compare incoming/outgoing directions over spatial windows, rather than
 * individual frames. Only geometry adds keys; speed and pauses do not.
 */
export function detectPositionCorners(samples: MotionSample[], start: number, end: number): number[] {
  const candidates: { index: number; left: number; right: number; similarity: number }[] = []
  for (let i = start + 1; i < end; i++) {
    let left = i - 1
    let right = i + 1
    while (left > start && distance(samples[left], samples[i]) < CORNER_WINDOW_PIXELS) left--
    while (right < end && distance(samples[right], samples[i]) < CORNER_WINDOW_PIXELS) right++
    const a = samples[left]
    const b = samples[i]
    const c = samples[right]
    const incoming = distance(a, b)
    const outgoing = distance(b, c)
    if (Math.min(incoming, outgoing) < CORNER_MIN_LEG_PIXELS) continue
    const similarity = ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / (incoming * outgoing)
    if (similarity <= Math.cos(CORNER_ANGLE_DEGREES * Math.PI / 180)) candidates.push({ index: i, left, right, similarity })
  }
  candidates.sort((a, b) => a.similarity - b.similarity || a.index - b.index)
  const selected: typeof candidates = []
  for (const candidate of candidates) {
    if (selected.some(other => candidate.index >= other.left && candidate.index <= other.right)) continue
    selected.push(candidate)
  }
  return selected.map(({ index, left }) => {
    // Choose arrival at a corner plateau rather than a later jitter extremum.
    let arrival = index
    while (arrival > left + 1 && distance(samples[arrival - 1], samples[index]) <= CORNER_JITTER_PIXELS) arrival--
    return arrival
  }).sort((a, b) => a - b)
}

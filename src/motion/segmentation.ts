import type { MotionSample } from './types'

/** Adjacent intervals share their boundary sample; all interior samples are kept. */
export function segmentSamplesByKeyframes(samples: MotionSample[], indices: number[]): MotionSample[][] {
  return indices.slice(0, -1).map((start, index) => samples.slice(start, indices[index + 1] + 1))
}

import type { MotionSample } from './types'

export type EasingChannel = 'position' | 'rotation'

export interface DerivedEasing {
  points: Array<{ time: number; progress: number }>
  cubic: [number, number, number, number]
  amount: number
}

export function deriveEasing(samples: MotionSample[], channel: EasingChannel): DerivedEasing {
  if (samples.length < 2) {
    return { points: [{ time: 0, progress: 0 }, { time: 1, progress: 1 }], cubic: [.33, .33, .67, .67], amount: 0 }
  }

  const startTime = samples[0].time
  const duration = Math.max(samples.at(-1)!.time - startTime, .001)
  const distances = [0]
  let total = 0

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    const change = channel === 'position'
      ? Math.hypot(current.x - previous.x, current.y - previous.y)
      : Math.abs(current.rotation - previous.rotation)
    total += change
    distances.push(total)
  }

  const hasMotion = total > (channel === 'position' ? .5 : .25)
  const points = samples.map((sample, index) => ({
    time: (sample.time - startTime) / duration,
    progress: hasMotion ? distances[index] / total : (sample.time - startTime) / duration,
  }))

  // Fit the captured progress to a cubic Bézier with fixed, evenly-spaced X handles.
  // This gives users four values they can reproduce in Alight Motion's curve editor.
  let a11 = 0
  let a12 = 0
  let a22 = 0
  let b1 = 0
  let b2 = 0
  for (const point of points) {
    const t = point.time
    const inverse = 1 - t
    const basis1 = 3 * inverse * inverse * t
    const basis2 = 3 * inverse * t * t
    const target = point.progress - t * t * t
    a11 += basis1 * basis1
    a12 += basis1 * basis2
    a22 += basis2 * basis2
    b1 += basis1 * target
    b2 += basis2 * target
  }
  const determinant = a11 * a22 - a12 * a12
  const fittedY1 = Math.abs(determinant) > 1e-8 ? (b1 * a22 - b2 * a12) / determinant : .33
  const fittedY2 = Math.abs(determinant) > 1e-8 ? (a11 * b2 - a12 * b1) / determinant : .67
  const clamp = (value: number) => Math.max(-.5, Math.min(1.5, value))

  return {
    points,
    cubic: [.33, clamp(fittedY1), .67, clamp(fittedY2)],
    amount: total,
  }
}

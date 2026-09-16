import assert from 'node:assert/strict'
import { it } from 'node:test'
import { buildMotionResult } from '../src/motion/engine.ts'
import { segmentSamplesByKeyframes } from '../src/motion/segmentation.ts'
import { deriveEasing, fitBezierToProgress } from '../src/easing.ts'

const samples = (points: number[][]) => points.map(([time, x, y = 0]) => ({ time, x, y, rotation: 0 }))
const check = (points: number[][], times: number[]) => {
  const input = samples(points)
  const result = buildMotionResult(input)
  assert.deepEqual(result.keyframes.position.map(p => p.time), times)
  assert.equal(result.curves.length, times.length - 1)
  for (const curve of result.curves) {
    assert.deepEqual(curve.points[0], { time: 0, progress: 0 })
    assert.deepEqual(curve.points.at(-1), { time: 1, progress: 1 })
    assert.ok(curve.cubic.every(Number.isFinite))
  }
  assert.deepEqual(buildMotionResult(input), result)
  return result
}

it('keeps straight motion to two keyframes', () => {
  check([[0, 0], [.2, 20], [.4, 40], [.6, 60]], [0, .6])
})

it('preserves an L trajectory with one timing interval', () => {
  check([[0, 330, 330], [.2, 450, 330], [.4, 600, 330], [.6, 830, 330], [.8, 830, 420], [1, 830, 520]], [0, 1])
})

it('keeps multiple turns as spatial controls', () => {
  check([[0, 0, 0], [.2, 20, 0], [.4, 40, 0], [.6, 40, 20], [.8, 40, 40], [1, 60, 40], [1.2, 80, 40]], [0, 1.2])
})

it('keeps dense corners and jitter out of timing keyframes', () => {
  const straight = Array.from({ length: 41 }, (_, i) => [i * .04, i * 3, i % 2 ? .5 : 0])
  check(straight, [0, 1.6])
  const corner = Array.from({ length: 41 }, (_, i) => [i * .04, Math.min(i, 19) * 3, Math.max(0, i - 19) * 3])
  check(corner, [0, 1.6])
})

it('keeps both long and brief holds inside the timing curve', () => {
  check([[0, 0], [.2, 20], [.4, 40], [.5, 40], [.8, 40], [1, 60], [1.2, 80]], [0, 1.2])
  check([[0, 0], [.2, 20], [.4, 40], [.5, 40], [.7, 60], [.9, 80]], [0, .9])
})

it('keeps speed changes inside one timing interval', () => {
  check([[0, 0], [.2, 10], [.4, 20], [.6, 70], [.8, 120]], [0, .8])
  check([[0, 0], [.2, 50], [.4, 100], [.6, 110], [.8, 120]], [0, .8])
  check([[0, 0], [.2, 50], [.4, 100], [.6, 110], [.8, 120], [1, 170], [1.2, 220]], [0, 1.2])
})

it('shares boundary samples without losing interior samples', () => {
  const input = samples([[0, 0], [.1, 10], [.2, 20], [.3, 30], [.4, 40]])
  assert.deepEqual(segmentSamplesByKeyframes(input, [0, 2, 4]), [input.slice(0, 3), input.slice(2)])
})

it('uses timing and travelled distance independently of spatial orientation', () => {
  const input = samples([[2, 0], [2.1, 10], [2.4, 40], [3, 100]])
  const rotated = input.map(p => ({ ...p, x: 42, y: p.x + 80 }))
  assert.deepEqual(deriveEasing(input, 'position'), deriveEasing(rotated, 'position'))
  assert.deepEqual(deriveEasing(input, 'position').points.map(p => p.progress), [0, .1, .4, 1])
})

it('includes initial and final pauses in one full-duration easing curve', () => {
  const initial = check([[0, 0], [.2, 0], [.4, 20], [.7, 60], [1, 100]], [0, 1])
  assert.deepEqual(initial.curves[0].points[1], { time: .2, progress: 0 })
  const final = check([[0, 0], [.2, 40], [.5, 100], [.7, 100], [1, 100]], [0, 1])
  assert.deepEqual(final.curves[0].points[3], { time: .7, progress: 1 })
  assert.notDeepEqual(initial.curves[0].cubic, final.curves[0].cubic)
  const both = check([[0, 0], [.2, 0], [.7, 100], [1, 100]], [0, 1])
  assert.deepEqual(both.curves[0].points.map(p => p.progress), [0, 0, 1, 1])
})

it('preserves all raw samples and L geometry independently of endpoint keyframes', () => {
  const input = samples([[0, 0, 0], [.2, 50, 0], [.4, 100, 0], [.7, 100, 50], [1, 100, 100]])
  const result = buildMotionResult(input)
  assert.deepEqual(result.samples, input)
  assert.deepEqual(result.spatialPath.points, input.map(({ x, y }) => ({ x, y })))
  assert.equal(result.spatialPath.totalLength, 200)
  assert.equal(result.spatialPath.reconstruction, 'move-along-path')
  assert.deepEqual(result.curves[0].points.map(p => p.progress), [0, .25, .5, .75, 1])
  assert.ok(result.steps.some(step => step.description.includes('Move Along Path Progress to 100%')))
  input[0].x = 99
  assert.equal(result.samples[0].x, 0)
})

it('preserves closed loops and curved paths using two endpoint keys', () => {
  for (const points of [
    [[0, 0, 0], [.25, 100, 0], [.5, 100, 100], [.75, 0, 100], [1, 0, 0]],
    Array.from({ length: 21 }, (_, i) => [i / 20, 100 * Math.cos(i * Math.PI / 40), 100 * Math.sin(i * Math.PI / 40)]),
  ]) {
    const result = check(points, [0, 1])
    assert.equal(result.spatialPath.reconstruction, 'move-along-path')
  }
})

it('fits known monotonic cubic progress and constrains difficult pauses', () => {
  const known = Array.from({ length: 21 }, (_, i) => {
    const t = i / 20
    return { time: t, progress: 3 * (1 - t) ** 2 * t * .2 + 3 * (1 - t) * t * t * .8 + t ** 3 }
  })
  const fitted = fitBezierToProgress(known)
  assert.ok(Math.abs(fitted[1] - .2) < 1e-10)
  assert.ok(Math.abs(fitted[3] - .8) < 1e-10)
  for (const points of [known, known.map(p => ({ ...p, progress: p.time < .8 ? 0 : 1 }))]) {
    const [x1, y1, x2, y2] = fitBezierToProgress(points)
    assert.ok(x1 >= 0 && x1 <= x2 && x2 <= 1)
    assert.ok(y1 >= 0 && y1 <= y2 && y2 <= 1)
  }
})

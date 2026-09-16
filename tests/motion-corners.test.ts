import assert from 'node:assert/strict'
import { it } from 'node:test'
import { buildMotionResult } from '../src/motion/engine.ts'
import { deriveEasing, emphasizeEasing } from '../src/easing.ts'

const linear = [.33, .33, .67, .67]
function constantSpeed(points: number[][]) {
  let time = 0
  return points.map(([x, y], i) => {
    if (i) time += Math.hypot(x - points[i - 1][0], y - points[i - 1][1]) / 100
    return { time, x, y, rotation: 0 }
  })
}
function checkCorner(points: number[][]) {
  const input = constantSpeed(points)
  const result = buildMotionResult(input)
  assert.equal(result.keyframes.position.length, 3)
  assert.equal(result.curves.length, 2)
  assert.deepEqual(result.keyframes.position[0], input[0])
  assert.deepEqual(result.keyframes.position.at(-1), input.at(-1))
  for (const curve of result.curves) {
    assert.deepEqual(curve.cubic, linear)
    assert.deepEqual(emphasizeEasing(curve.cubic, .6), linear)
    assert.equal(curve.points[0].time, 0)
    assert.equal(curve.points.at(-1)!.time, 1)
  }
  assert.equal(result.curves[0].endTime, result.keyframes.position[1].time)
  assert.equal(result.curves[1].startTime, result.keyframes.position[1].time)
  assert.deepEqual(buildMotionResult(input), result)
  return result
}

it('creates an exact corner keyframe with two linear intervals at constant speed', () => {
  const result = checkCorner([[0, 0], [10, 0], [20, 0], [30, 0], [30, 10], [30, 20], [30, 30]])
  assert.equal(result.keyframes.position[1].x, 30)
  assert.equal(result.keyframes.position[1].y, 0)
})

it('detects a corner recorded as two smaller direction changes', () => {
  checkCorner([[0, 0], [10, 0], [20, 0], [28, 0], [30, 2], [30, 10], [30, 20], [30, 30]])
})

it('ignores straight-line jitter and does not add pause or speed-change keys', () => {
  const jitter = Array.from({ length: 31 }, (_, i) => ({ time: i * .04, x: i * 4, y: i % 2 ? .3 : 0, rotation: 0 }))
  const result = buildMotionResult(jitter)
  assert.equal(result.keyframes.position.length, 2)
  assert.deepEqual(result.curves[0].cubic, linear)
  const pause = [0, 10, 20, 20, 20, 21, 40, 60].map((x, i) => ({ time: i * .2, x, y: 0, rotation: 0 }))
  assert.equal(buildMotionResult(pause).keyframes.position.length, 2)
})

it('retains multiple separated corners', () => {
  const points = [[0, 0], [10, 0], [20, 0], [30, 0], [30, 10], [30, 20], [30, 30], [40, 30], [50, 30], [60, 30]]
  const result = buildMotionResult(constantSpeed(points))
  assert.equal(result.keyframes.position.length, 4)
  assert.equal(result.curves.length, 3)
})

it('snaps small progress errors to linear but preserves genuine acceleration', () => {
  const sample = (positions: number[]) => positions.map((x, i) => ({ time: i / 4, x, y: 0, rotation: 0 }))
  assert.deepEqual(deriveEasing(sample([0, 26, 49, 76, 100]), 'position').cubic, linear)
  assert.notDeepEqual(deriveEasing(sample([0, 5, 20, 50, 100]), 'position').cubic, linear)
})

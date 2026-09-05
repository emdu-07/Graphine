import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildMotionResult } from '../src/motion/engine.ts'
import type { MotionSample } from '../src/motion/types.ts'

const normalMotion: MotionSample[] = [
  { time: 0, x: 0, y: 0, rotation: 0 },
  { time: .25, x: 10, y: 0, rotation: 15 },
  { time: .5, x: 20, y: 10, rotation: 30 },
  { time: .75, x: 35, y: 20, rotation: 50 },
  { time: 1, x: 50, y: 30, rotation: 80 },
]

describe('buildMotionResult', () => {
  it('returns an empty deterministic result for empty input', () => {
    assert.deepEqual(buildMotionResult([]), {
      duration: 0,
      sampleCount: 0,
      keyframes: { position: [], rotation: [] },
      curves: [],
      steps: [{
        id: 'create-detected-property-tracks',
        index: 0,
        title: 'Create the detected property tracks',
        description: 'No position or rotation change exceeded the motion threshold.',
      }],
    })
  })

  it('returns one keyframe and no curves for a single sample', () => {
    const sample = { time: .2, x: 12, y: 34, rotation: 56 }
    const result = buildMotionResult([sample])

    assert.deepEqual(result.keyframes, { position: [], rotation: [] })
    assert.equal(result.curves.length, 0)
  })

  it('builds normal recorded motion results for both channels', () => {
    const result = buildMotionResult(normalMotion)

    assert.equal(result.duration, 1)
    assert.equal(result.sampleCount, 5)
    assert.deepEqual(result.keyframes.position, [normalMotion[0], normalMotion.at(-1)])
    assert.deepEqual(result.keyframes.rotation, [normalMotion[0], normalMotion.at(-1)])
    assert.equal(result.curves.filter(curve => curve.channel === 'position').length, 1)
    assert.equal(result.curves.filter(curve => curve.channel === 'rotation').length, 1)
    assert.deepEqual(result.steps.at(-1), {
      id: 'rotation-keyframe-2',
      index: 2,
      channel: 'rotation',
      title: 'Rotation keyframe at 1.00 seconds',
      description: 'Set Rotation to 80°.',
    })
  })

  it('omits unchanged property tracks for stationary motion', () => {
    const stationary = normalMotion.map(sample => ({ ...sample, x: 20, y: 30, rotation: 40 }))
    const result = buildMotionResult(stationary)

    assert.deepEqual(result.keyframes, { position: [], rotation: [] })
    assert.deepEqual(result.curves, [])
  })

  it('handles repeated timestamps using the existing easing fallback', () => {
    const repeated = [
      { time: 1, x: 0, y: 0, rotation: 0 },
      { time: 1, x: 10, y: 0, rotation: 20 },
    ]
    const result = buildMotionResult(repeated)

    assert.equal(result.duration, 1)
    assert.equal(result.curves.length, 2)
    assert.ok(result.curves.flatMap(curve => curve.cubic).every(Number.isFinite))
  })

  it('preserves position distance and rotation amount calculations', () => {
    const result = buildMotionResult(normalMotion)
    const position = result.curves.find(curve => curve.channel === 'position')
    const rotation = result.curves.find(curve => curve.channel === 'rotation')

    assert.ok(position)
    assert.ok(rotation)
    assert.ok(Math.abs(position.amount - (10 + Math.hypot(10, 10) + 2 * Math.hypot(15, 10))) < 1e-10)
    assert.equal(rotation.amount, 80)
    assert.equal(position.cubic.length, 4)
    assert.equal(rotation.cubic.length, 4)
  })

  it('produces identical output for identical input', () => {
    assert.deepEqual(buildMotionResult(normalMotion), buildMotionResult(normalMotion))
  })

  it('separates position direction reversals into individual keyframe segments', () => {
    const samples = [
      { time: 0, x: 0, y: 0, rotation: 0 },
      { time: .25, x: 20, y: 0, rotation: 0 },
      { time: .5, x: 40, y: 0, rotation: 0 },
      { time: .75, x: 30, y: 0, rotation: 0 },
      { time: 1, x: 25, y: 0, rotation: 0 },
    ]

    const result = buildMotionResult(samples)
    assert.deepEqual(result.keyframes.position.map(keyframe => keyframe.time), [0, .5, 1])
    assert.deepEqual(result.keyframes.rotation, [])
    assert.equal(result.curves.filter(curve => curve.channel === 'position').length, 2)
    assert.deepEqual(
      result.curves.filter(curve => curve.channel === 'position').map(curve => [curve.startTime, curve.endTime]),
      [[0, .5], [.5, 1]],
    )
  })

  it('separates rotation direction reversals into individual keyframe segments', () => {
    const samples = [
      { time: 0, x: 0, y: 0, rotation: 0 },
      { time: .25, x: 10, y: 0, rotation: 20 },
      { time: .5, x: 20, y: 0, rotation: 40 },
      { time: .75, x: 30, y: 0, rotation: 30 },
      { time: 1, x: 40, y: 0, rotation: 25 },
    ]

    const result = buildMotionResult(samples)
    assert.deepEqual(result.keyframes.position.map(keyframe => keyframe.time), [0, 1])
    assert.deepEqual(result.keyframes.rotation.map(keyframe => keyframe.time), [0, .5, 1])
    assert.equal(result.curves.filter(curve => curve.channel === 'rotation').length, 2)
  })

  it('ignores small positional and rotational jitter around a reversal', () => {
    const samples = [
      { time: 0, x: 0, y: 0, rotation: 0 },
      { time: .2, x: 20, y: 0, rotation: 20 },
      { time: .4, x: 40, y: 0, rotation: 40 },
      { time: .5, x: 39.5, y: .3, rotation: 39.6 },
      { time: .6, x: 40.4, y: -.2, rotation: 40.4 },
      { time: .8, x: 30, y: 0, rotation: 30 },
      { time: 1, x: 25, y: 0, rotation: 25 },
    ]

    const result = buildMotionResult(samples)
    assert.deepEqual(result.keyframes.position.map(keyframe => keyframe.time), [0, .4, 1])
    assert.deepEqual(result.keyframes.rotation.map(keyframe => keyframe.time), [0, .4, 1])
  })

  it('starts a rotation track when rotation actually begins', () => {
    const samples = [
      { time: 0, x: 0, y: 0, rotation: 0 },
      { time: .5, x: 0, y: 0, rotation: 0 },
      { time: .95, x: 0, y: 0, rotation: 0 },
      { time: 1, x: 0, y: 0, rotation: 0 },
      { time: 1.05, x: 0, y: 0, rotation: .4 },
      { time: 1.1, x: 0, y: 0, rotation: 2 },
      { time: 1.15, x: 0, y: 0, rotation: 5 },
      { time: 1.2, x: 0, y: 0, rotation: 9 },
      { time: 1.5, x: 0, y: 0, rotation: 9 },
      { time: 2, x: 0, y: 0, rotation: 9 },
    ]

    const result = buildMotionResult(samples)
    assert.deepEqual(result.keyframes.position, [])
    assert.deepEqual(result.keyframes.rotation.map(keyframe => keyframe.time), [1, 1.2])
    assert.equal(result.curves[0].startTime, 1)
    assert.equal(result.curves[0].endTime, 1.2)
  })
})

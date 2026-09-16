import assert from 'node:assert/strict'
import { it } from 'node:test'
import { defaultEasingEmphasis, emphasizeEasing } from '../src/easing.ts'

it('defaults to 60% only for positive intervals up to 1.5 seconds', () => {
  for (const duration of [.1, 1.23, 1.5]) assert.equal(defaultEasingEmphasis(duration), .6)
  for (const duration of [1.501, 3, 0, -1, NaN, Infinity]) assert.equal(defaultEasingEmphasis(duration), 0)
})

it('expands the reference curve bends while preserving time handles', () => {
  const input: [number, number, number, number] = [.33, .96, .67, .51]
  const output = emphasizeEasing(input, .6)
  assert.ok(Math.abs(output[1] - 1.338) < 1e-10)
  assert.ok(Math.abs(output[3] - .414) < 1e-10)
  assert.equal(output[0], input[0])
  assert.equal(output[2], input[2])
  assert.deepEqual(input, [.33, .96, .67, .51])
  assert.deepEqual(emphasizeEasing(input, 0), input)
})

it('keeps constant-speed curves linear and bounds stylization', () => {
  assert.deepEqual(emphasizeEasing([.33, .33, .67, .67], 1), [.33, .33, .67, .67])
  assert.deepEqual(emphasizeEasing([.33, 1.4, .67, -.3], 10), [.33, 1.5, .67, -.5])
  assert.deepEqual(emphasizeEasing([.33, .96, .67, .51], NaN), [.33, .96, .67, .51])
})

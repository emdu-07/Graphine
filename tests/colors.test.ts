import assert from 'node:assert/strict'
import { it } from 'node:test'
import { colorCoordinates, formatColorInput, parseColor, spectrumColor } from '../src/color/colors.ts'

it('accepts custom RGB and hex colors and normalizes them for the canvas', () => {
  assert.equal(parseColor('rgb(0,0,0)'), '#000000')
  assert.equal(parseColor(' RGB(255, 128, 64) '), '#ff8040')
  assert.equal(parseColor('#AbC'), '#aabbcc')
  assert.equal(parseColor('#A1B2C3'), '#a1b2c3')
})
it('rejects malformed and out-of-range input', () => {
  for (const value of ['', 'red', '#12', '#gggggg', 'rgb(256,0,0)', 'rgb(-1,0,0)', 'rgb(1,2)', 'url(test)']) {
    assert.equal(parseColor(value), null)
  }
})
it('maps the spectrum to white, black, and the expected rainbow colors', () => {
  for (const hue of [0, 60, 120, 180, 240, 300, 360]) {
    assert.equal(spectrumColor(hue, 100), '#ffffff')
    assert.equal(spectrumColor(hue, 0), '#000000')
  }
  assert.equal(spectrumColor(0, 50), '#ff0000')
  assert.equal(spectrumColor(120, 50), '#00ff00')
  assert.equal(spectrumColor(240, 50), '#0000ff')
  assert.equal(spectrumColor(360, 50), '#ff0000')
  assert.equal(spectrumColor(-10, 120), '#ffffff')
})

it('wraps comma-separated input immediately without duplicating RGB parentheses', () => {
  assert.equal(formatColorInput('0,'), 'rgb(0,)')
  assert.equal(formatColorInput('0,0,0'), 'rgb(0,0,0)')
  assert.equal(formatColorInput('255, 128, 64'), 'rgb(255, 128, 64)')
  for (const value of ['', '0', '#aabbcc', 'rgb(0,)', 'rgb(0,0,0)', 'RGB(1,2,3)']) {
    assert.equal(formatColorInput(value), value)
  }
  assert.equal(parseColor(formatColorInput('0,0,0')), '#000000')
  assert.equal(parseColor(formatColorInput('256,0,0')), null)
})

it('positions the gradient indicator for preset and custom colors', () => {
  assert.deepEqual(colorCoordinates('#00ff00'), { hue: 120, lightness: 50 })
  assert.deepEqual(colorCoordinates('rgb(0,0,255)'), { hue: 240, lightness: 50 })
  assert.deepEqual(colorCoordinates('#ffffff'), { hue: 0, lightness: 100 })
  assert.deepEqual(colorCoordinates('#000000'), { hue: 0, lightness: 0 })
  for (const hue of [0, 60, 120, 180, 240, 300]) {
    assert.deepEqual(colorCoordinates(spectrumColor(hue, 50)), { hue, lightness: 50 })
  }
})

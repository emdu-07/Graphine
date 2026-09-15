export function formatColorInput(input: string): string {
  return input.includes(',') && /^[\d,\s]*$/.test(input) ? `rgb(${input})` : input
}

export function parseColor(input: string): string | null {
  const value = input.trim()
  if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase()
  if (/^#[\da-f]{3}$/i.test(value)) return '#' + [...value.slice(1)].map(char => char + char).join('').toLowerCase()
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(value)
  if (!rgb) return null
  const channels = rgb.slice(1).map(Number)
  if (channels.some(channel => channel > 255)) return null
  return '#' + channels.map(channel => channel.toString(16).padStart(2, '0')).join('')
}

export function spectrumColor(hue: number, lightness: number): string {
  const h = Math.min(360, Math.max(0, hue)) / 60
  const l = Math.min(100, Math.max(0, lightness)) / 100
  const c = 1 - Math.abs(2 * l - 1)
  const x = c * (1 - Math.abs(h % 2 - 1))
  const channels = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  return '#' + channels.map(channel => Math.round((channel + l - c / 2) * 255).toString(16).padStart(2, '0')).join('')
}

export function colorCoordinates(color: string): { hue: number; lightness: number } {
  const hex = parseColor(color) ?? '#000000'
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const sector = delta === 0 ? 0 : max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return { hue: ((sector * 60) + 360) % 360, lightness: (max + min) * 50 }
}

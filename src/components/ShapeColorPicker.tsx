import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { colorCoordinates, formatColorInput, parseColor, spectrumColor } from '../color/colors'

const PRESETS = [
  ['Lavender', '#b7a5ff'], ['Orange', '#ffbb6c'], ['Mint', '#79d6c3'],
  ['Blue', '#86b7ff'], ['Pink', '#f58eb5'], ['Yellow', '#f9dc79'],
  ['White', '#ffffff'], ['Black', '#000000'],
]

export function ShapeColorPicker({ value, onChange, disabled = false }: {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState(false)
  const [hue, setHue] = useState(() => colorCoordinates(value).hue)
  const [lightness, setLightness] = useState(() => colorCoordinates(value).lightness)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const customInput = useRef<HTMLInputElement>(null)
  const pendingSelection = useRef<{ start: number; end: number } | null>(null)

  useLayoutEffect(() => {
    const selection = pendingSelection.current
    if (selection) {
      customInput.current?.setSelectionRange(selection.start, selection.end)
      pendingSelection.current = null
    }
  }, [draft])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const choose = (color: string) => {
    setDraft(color)
    setError(false)
    onChange(color)
  }
  const chooseCustom = (color: string) => {
    const coordinates = colorCoordinates(color)
    setHue(coordinates.hue)
    setLightness(coordinates.lightness)
    choose(color)
  }
  const pickSpectrum = (event: PointerEvent<HTMLDivElement>) => {
    if (event.type === 'pointermove' && !event.currentTarget.hasPointerCapture(event.pointerId)) return
    if (event.type === 'pointerdown') event.currentTarget.setPointerCapture(event.pointerId)
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const nextHue = Math.max(0, Math.min(360, (event.clientX - bounds.left) / bounds.width * 360))
    const nextLightness = Math.max(0, Math.min(100, (1 - (event.clientY - bounds.top) / bounds.height) * 100))
    setHue(nextHue)
    setLightness(nextLightness)
    choose(spectrumColor(nextHue, nextLightness))
  }

  return (
    <div className="shape-color-picker" ref={root} onKeyDown={event => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false)
    }}>
      <button ref={trigger} type="button" className="shape-color-trigger" aria-label="Shape color" aria-expanded={open && !disabled} aria-controls={id} disabled={disabled} onClick={() => {
        setDraft(value); setError(false); setOpen(!open)
      }}>
        <span style={{ background: value }} /><ChevronDown size={12} />
      </button>
      {open && !disabled && <div id={id} className="shape-color-panel" role="group" aria-label="Choose shape color">
        <strong>Shape color</strong>
        <div className="color-presets">
          {PRESETS.map(([name, color]) => <button key={name} type="button" style={{ background: color }} aria-label={name} aria-pressed={value.toLowerCase() === color} title={name} onClick={() => chooseCustom(color)} />)}
        </div>
        <div className="color-spectrum" tabIndex={0} role="group" aria-label="Color spectrum; use the hue and lightness sliders for keyboard selection" onPointerDown={pickSpectrum} onPointerMove={pickSpectrum}>
          <span className="color-spectrum-dot" aria-hidden="true" style={{ left: `${hue / 360 * 100}%`, top: `${100 - lightness}%`, background: value }} />
        </div>
        <label className="color-slider">Hue<input type="range" min="0" max="360" value={hue} onChange={event => {
          const next = Number(event.target.value); setHue(next); choose(spectrumColor(next, lightness))
        }} /></label>
        <label className="color-slider">Lightness<input type="range" min="0" max="100" value={lightness} onChange={event => {
          const next = Number(event.target.value); setLightness(next); choose(spectrumColor(hue, next))
        }} /></label>
        <form onSubmit={event => {
          event.preventDefault()
          const parsed = parseColor(draft)
          if (parsed) chooseCustom(parsed)
          else setError(true)
        }}>
          <label htmlFor={`${id}-value`}>RGB or hex</label>
          <div className="color-custom"><input ref={customInput} id={`${id}-value`} value={draft} placeholder="rgb(0,0,0) or #000000" aria-invalid={error} aria-describedby={error ? `${id}-error` : undefined} onChange={event => {
            const input = event.target
            const formatted = formatColorInput(input.value)
            if (formatted !== input.value) {
              // Keep typing inside the new parentheses, immediately after the comma.
              pendingSelection.current = { start: (input.selectionStart ?? input.value.length) + 4, end: (input.selectionEnd ?? input.value.length) + 4 }
            }
            setDraft(formatted)
            setError(false)
          }} /><button type="submit">Apply</button></div>
          {error && <p id={`${id}-error`} role="alert">Use #000000 or rgb(0,0,0).</p>}
        </form>
      </div>}
    </div>
  )
}

import { Check } from 'lucide-react'
import type { CurvePreset } from '../types'

interface CurveGraphProps {
  curve: CurvePreset
  selected?: boolean
  compact?: boolean
  onClick?: () => void
}

export function CurveGraph({ curve, selected, compact, onClick }: CurveGraphProps) {
  return (
    <button
      className={`curve-card ${selected ? 'is-selected' : ''} ${compact ? 'is-compact' : ''}`}
      onClick={onClick}
      type="button"
      aria-pressed={selected}
    >
      {selected && <span className="selected-tick"><Check size={12} strokeWidth={3} /></span>}
      <svg viewBox="0 0 120 92" role="img" aria-label={`${curve.name} timing curve`}>
        <path className="grid-line" d="M8 8V84H112" />
        <path className="curve-path curve-shadow" d={curve.path} />
        <path className="curve-path" d={curve.path} />
        <circle cx="8" cy="84" r="3.5" />
        <circle cx="112" cy="8" r="3.5" />
      </svg>
      {!compact && (
        <span className="curve-label">
          <strong>{curve.name}</strong>
          <small>{curve.subtitle}</small>
        </span>
      )}
    </button>
  )
}

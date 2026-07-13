import type { MotionSample } from '../types'

interface RecordedGraphProps {
  label: string
  unit: string
  color: string
  samples: MotionSample[]
  value: (sample: MotionSample) => number
}

export function RecordedGraph({ label, unit, color, samples, value }: RecordedGraphProps) {
  const values = samples.map(value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = Math.max(max - min, 1)
  const duration = Math.max(samples.at(-1)?.time ?? 1, 0.1)
  const points = samples.map((sample) => {
    const x = 16 + (sample.time / duration) * 268
    const y = 100 - ((value(sample) - min) / spread) * 72
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <div className="recorded-graph">
      <div className="recorded-graph-head">
        <div><span className="graph-color" style={{ background: color }} />{label}</div>
        <strong>{Math.round(min)} → {Math.round(max)} {unit}</strong>
      </div>
      <svg viewBox="0 0 300 116" role="img" aria-label={`${label} recorded motion graph`}>
        <path className="recording-grid" d="M16 16V100H284M16 58H284" />
        <polyline className="recording-shadow" points={points} style={{ stroke: color }} />
        <polyline className="recording-line" points={points} style={{ stroke: color }} />
        {points && <><circle cx={points.split(' ')[0].split(',')[0]} cy={points.split(' ')[0].split(',')[1]} r="3" style={{ fill: color }} /><circle cx={points.split(' ').at(-1)?.split(',')[0]} cy={points.split(' ').at(-1)?.split(',')[1]} r="3" style={{ fill: color }} /></>}
      </svg>
    </div>
  )
}

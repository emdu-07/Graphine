import { Copy } from 'lucide-react'
import { useState } from 'react'
import { deriveEasing, type EasingChannel } from '../easing'
import type { MotionSample } from '../types'

interface RecordedGraphProps {
  label: string
  samples: MotionSample[]
  channel: EasingChannel
}

const GRAPH = { left: 28, right: 284, top: 18, bottom: 146 }

export function RecordedGraph({ label, samples, channel }: RecordedGraphProps) {
  const [copied, setCopied] = useState(false)
  const easing = deriveEasing(samples, channel)
  const [x1, y1, x2, y2] = easing.cubic
  const width = GRAPH.right - GRAPH.left
  const height = GRAPH.bottom - GRAPH.top
  const mapX = (value: number) => GRAPH.left + value * width
  const mapY = (value: number) => GRAPH.bottom - value * height
  const trace = easing.points.map(point => `${mapX(point.time).toFixed(1)},${mapY(point.progress).toFixed(1)}`).join(' ')
  const path = `M ${GRAPH.left} ${GRAPH.bottom} C ${mapX(x1)} ${mapY(y1)}, ${mapX(x2)} ${mapY(y2)}, ${GRAPH.right} ${GRAPH.top}`
  const color = channel === 'position' ? '#a7f7d2' : '#b7a5ff'
  const values = easing.cubic.map(value => value.toFixed(2)).join(', ')

  const copyCurve = async () => {
    await navigator.clipboard.writeText(values)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="easing-card">
      <div className="easing-card-head">
        <div><span className="graph-color" style={{ background: color }} /> <strong>{label}</strong></div>
        <span>{easing.amount < .5 ? 'No change' : `${Math.round(easing.amount)} ${channel === 'position' ? 'px travelled' : '° turned'}`}</span>
      </div>
      <svg viewBox="0 0 312 168" role="img" aria-label={`${channel} easing curve for ${label}`}>
        <path className="easing-grid" d={`M${GRAPH.left} ${GRAPH.top}V${GRAPH.bottom}H${GRAPH.right}M${GRAPH.left} ${GRAPH.top}H${GRAPH.right}M${GRAPH.left} ${(GRAPH.top + GRAPH.bottom) / 2}H${GRAPH.right}`} />
        <line className="handle-line" x1={GRAPH.left} y1={GRAPH.bottom} x2={mapX(x1)} y2={mapY(y1)} />
        <line className="handle-line" x1={GRAPH.right} y1={GRAPH.top} x2={mapX(x2)} y2={mapY(y2)} />
        <polyline className="captured-trace" points={trace} />
        <path className="fitted-curve curve-glow" d={path} style={{ stroke: color }} />
        <path className="fitted-curve" d={path} style={{ stroke: color }} />
        <circle className="curve-endpoint" cx={GRAPH.left} cy={GRAPH.bottom} r="4" />
        <circle className="curve-endpoint filled" cx={GRAPH.right} cy={GRAPH.top} r="4" style={{ fill: color }} />
        <circle className="curve-handle" cx={mapX(x1)} cy={mapY(y1)} r="5" />
        <circle className="curve-handle" cx={mapX(x2)} cy={mapY(y2)} r="5" />
        <text x="4" y={GRAPH.top + 3}>100%</text><text x="10" y={GRAPH.bottom + 3}>0%</text>
        <text x={GRAPH.left} y="163">START</text><text x={GRAPH.right - 18} y="163">END</text>
      </svg>
      <div className="bezier-values">
        <div><span>ALIGHT MOTION HANDLES</span><code>{values}</code></div>
        <button onClick={copyCurve} title="Copy curve values"><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  )
}

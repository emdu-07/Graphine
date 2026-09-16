import type { SpatialPath } from '../../motion/types'

export function SpatialTrajectory({ path }: { path: SpatialPath }) {
  if (!path.points.length) return null
  const xs = path.points.map(p => p.x)
  const ys = path.points.map(p => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const width = Math.max(1, Math.max(...xs) - minX)
  const height = Math.max(1, Math.max(...ys) - minY)
  const padding = Math.max(width, height) * .05
  return <div className="tip-card"><div>
    <strong>Spatial trajectory</strong>
    <p>{path.reconstruction === 'move-along-path' ? 'Use this separate vector path with Move Along Path. Apply the easing graph to its Progress control.' : 'Use the endpoint position values with the easing graph.'}</p>
    <svg width="100%" height="160" viewBox={`${minX - padding} ${minY - padding} ${width + 2 * padding} ${height + 2 * padding}`} role="img" aria-label="Spatial trajectory, separate from the timing graph">
      <polyline points={path.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
    <details><summary>Path coordinates in travel order</summary><p style={{ maxHeight: 160, overflow: 'auto', overflowWrap: 'anywhere' }}>{path.points.map(p => `(${p.x}, ${p.y})`).join(' → ')}</p></details>
  </div></div>
}

import { MousePointer2, RotateCw, Sparkles, WandSparkles } from 'lucide-react'
import { RecordedGraph } from '../../components/RecordedGraph'
import type { MotionChannel, MotionResult } from '../../motion/types'

interface MotionGraphsProps {
  motionResult: MotionResult
  curveChannel: MotionChannel
  setCurveChannel: (channel: MotionChannel) => void
  onShowSteps: () => void
}

export function MotionGraphs({ motionResult, curveChannel, setCurveChannel, onShowSteps }: MotionGraphsProps) {
  const curves = motionResult.curves.filter(curve => curve.channel === curveChannel)
  return (
    <div className="guide-content recording-results">
      <div className="generated-title"><div><p className="kicker">CAPTURE COMPLETE</p><h2>Alight easing curves</h2><p>One curve for each pair of keyframes.</p></div><WandSparkles size={22} /></div>
      <div className="curve-channel-switch" aria-label="Curve property">
        <button className={curveChannel === 'position' ? 'active' : ''} onClick={() => setCurveChannel('position')}><MousePointer2 size={14} /> Position</button>
        <button className={curveChannel === 'rotation' ? 'active' : ''} onClick={() => setCurveChannel('rotation')}><RotateCw size={14} /> Rotation</button>
      </div>
      <div className="curve-explainer"><span>X</span><p><strong>Time → remapped progress</strong>The dotted line is your captured timing; the solid curve is the fitted Alight Motion curve.</p></div>
      <div className="recorded-graphs">{curves.map(curve => <RecordedGraph key={`${curve.channel}-${curve.segmentIndex}`} curve={curve} />)}</div>
      <div className="sample-summary"><div><span>DURATION</span><strong>{motionResult.duration.toFixed(1)}s</strong></div><div><span>KEYFRAMES</span><strong>{motionResult.keyframes.position.length} position keyframes<br />{motionResult.keyframes.rotation.length} rotation keyframes</strong></div></div>
      <button className="generate-button" onClick={() => onShowSteps()}><Sparkles size={17} /> View Alight Motion steps</button>
    </div>
  )
}

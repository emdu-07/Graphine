import { Copy, Sparkles, Upload } from 'lucide-react'
import type { MotionResult } from '../../motion/types'

interface MotionStepsProps {
  motionResult: MotionResult
  copied: boolean
  copyMotionData: () => Promise<void>
}

export function MotionSteps({ motionResult, copied, copyMotionData }: MotionStepsProps) {
  return (
    <div className="guide-content steps-content">
      <div className="generated-title"><div><p className="kicker">ALIGHT MOTION</p><h2>Rebuild this motion</h2><p>Use these sampled keyframes as your guide.</p></div><Upload size={22} /></div>
      <div className="steps-list">
        {motionResult.steps.map(step => <div className="instruction" data-channel={step.channel} key={step.id}><span>{String(step.index).padStart(2, '0')}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></div>)}
      </div>
      <div className="tip-card"><Sparkles size={17} /><div><strong>Apply each curve separately</strong><p>Move the playhead between each keyframe pair, open the Curve Editor, then enter the four handle values shown on its graph.</p></div></div>
      <button className="generate-button" onClick={copyMotionData}><Copy size={17} /> {copied ? 'Copied keyframes' : 'Copy keyframe values'}</button>
    </div>
  )
}

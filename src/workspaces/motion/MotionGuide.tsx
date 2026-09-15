import { useState } from 'react'
import { Sparkles, WandSparkles } from 'lucide-react'
import type { MotionChannel, MotionResult } from '../../motion/types'
import { MotionGraphs } from './MotionGraphs'
import { MotionSteps } from './MotionSteps'

export type MotionGuideTab = 'curves' | 'steps'

interface MotionGuideProps {
  motionResult: MotionResult
  activeTab: MotionGuideTab
  setActiveTab: (tab: MotionGuideTab) => void
}

export function MotionGuide({ motionResult, activeTab, setActiveTab }: MotionGuideProps) {
  const [curveChannel, setCurveChannel] = useState<MotionChannel>('position')
  const [copied, setCopied] = useState(false)
  const copyMotionData = async () => {
    const positionValues = motionResult.keyframes.position.map(sample => `${sample.time.toFixed(2)}s — X ${Math.round(sample.x)}, Y ${Math.round(sample.y)}`)
    const rotationValues = motionResult.keyframes.rotation.map(sample => `${sample.time.toFixed(2)}s — Rotation ${Math.round(sample.rotation)}°`)
    const value = [
      ...(positionValues.length ? ['POSITION', ...positionValues] : []),
      ...(positionValues.length && rotationValues.length ? [''] : []),
      ...(rotationValues.length ? ['ROTATION', ...rotationValues] : []),
    ].join('\n')
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <aside className="guide-panel">
      <div className="guide-head"><div className="ai-badge"><Sparkles size={14} /> MOTION GUIDE</div><div className="tabs"><button className={activeTab === 'curves' ? 'active' : ''} onClick={() => setActiveTab('curves')}>Graphs</button><button className={activeTab === 'steps' ? 'active' : ''} onClick={() => setActiveTab('steps')}>Steps</button></div></div>

      {motionResult.sampleCount === 0 ? (
        <div className="empty-guide">
          <div className="empty-orbit"><WandSparkles size={25} /></div>
          <p className="kicker">WAITING FOR MOTION</p><h2>Your graphs will appear here.</h2>
          <p>Choose a duration, press record, then move and rotate the object during the capture window.</p>
          <div className="capture-signals"><span><i style={{ background: '#a7f7d2' }} /> X-position</span><span><i style={{ background: '#86b7ff' }} /> Y-position</span><span><i style={{ background: '#b7a5ff' }} /> Rotation</span></div>
        </div>
      ) : activeTab === 'curves' ? (
        <MotionGraphs motionResult={motionResult} curveChannel={curveChannel} setCurveChannel={setCurveChannel} onShowSteps={() => setActiveTab('steps')} />
      ) : (
        <MotionSteps motionResult={motionResult} copied={copied} copyMotionData={copyMotionData} />
      )}
    </aside>
  )
}

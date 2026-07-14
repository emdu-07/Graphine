import { useEffect, useRef, useState } from 'react'
import {
  Aperture, Box, ChevronDown, Circle as CircleIcon, Copy, Download, Grid2X2, HelpCircle,
  ImagePlus, Layers3, MousePointer2, Play, Plus, RotateCw, Share2, Sparkles, Square,
  StopCircle, Triangle, Undo2, Upload, WandSparkles,
} from 'lucide-react'
import { MotionStage } from './components/MotionStage'
import { RecordedGraph } from './components/RecordedGraph'
import { PALETTE } from './data'
import type { EasingChannel } from './easing'
import type { MotionObject, MotionSample, ShapeKind } from './types'

const INITIAL_OBJECT: MotionObject = {
  id: 'object-1', name: 'Lavender shape', kind: 'square', x: 300, y: 210,
  startX: 300, startY: 210, width: 126, height: 126, rotation: 0, fill: PALETTE[0],
}

type CapturePhase = 'idle' | 'countdown' | 'recording' | 'complete'

function App() {
  const [object, setObject] = useState(INITIAL_OBJECT)
  const [duration, setDuration] = useState(3)
  const [activeTab, setActiveTab] = useState<'curves' | 'steps'>('curves')
  const [curveChannel, setCurveChannel] = useState<EasingChannel>('position')
  const [phase, setPhase] = useState<CapturePhase>('idle')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [samples, setSamples] = useState<MotionSample[]>([])
  const [trailSamples, setTrailSamples] = useState<MotionSample[]>([])
  const [showShapes, setShowShapes] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const objectRef = useRef(object)
  const sampleBuffer = useRef<MotionSample[]>([])

  const updateObject = (next: MotionObject) => {
    objectRef.current = next
    setObject(next)
  }

  useEffect(() => {
    if (phase !== 'countdown' || countdown === null) return
    const timer = window.setTimeout(() => {
      if (countdown > 1) setCountdown(countdown - 1)
      else {
        setCountdown(null)
        sampleBuffer.current = []
        setPhase('recording')
      }
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [phase, countdown])

  useEffect(() => {
    if (phase !== 'recording') return
    const startedAt = performance.now()
    let frame = 0
    let lastSampleAt = -40

    const capture = (now: number) => {
      const elapsed = Math.min((now - startedAt) / 1000, duration)
      setProgress(elapsed / duration)
      if (elapsed * 1000 - lastSampleAt >= 32 || elapsed >= duration) {
        const current = objectRef.current
        sampleBuffer.current.push({ time: elapsed, x: current.x, y: current.y, rotation: current.rotation })
        setTrailSamples([...sampleBuffer.current])
        lastSampleAt = elapsed * 1000
      }
      if (elapsed < duration) frame = requestAnimationFrame(capture)
      else {
        setSamples([...sampleBuffer.current])
        setPhase('complete')
        setActiveTab('curves')
      }
    }
    frame = requestAnimationFrame(capture)
    return () => cancelAnimationFrame(frame)
  }, [phase, duration])

  const startCapture = () => {
    if (phase === 'countdown' || phase === 'recording') return
    const current = objectRef.current
    updateObject({ ...current, startX: current.x, startY: current.y })
    setSamples([])
    setTrailSamples([])
    sampleBuffer.current = []
    setProgress(0)
    setCountdown(3)
    setPhase('countdown')
  }

  const stopCapture = () => {
    if (phase !== 'recording') return
    setSamples([...sampleBuffer.current])
    setPhase('complete')
    setActiveTab('curves')
  }

  const addShape = (kind: ShapeKind) => {
    updateObject({ ...INITIAL_OBJECT, id: crypto.randomUUID(), kind, name: `${kind[0].toUpperCase()}${kind.slice(1)} layer`, fill: kind === 'circle' ? PALETTE[2] : kind === 'triangle' ? PALETTE[1] : PALETTE[0] })
    setShowShapes(false)
    setSamples([])
    setTrailSamples([])
    setPhase('idle')
    setProgress(0)
  }

  const handleUpload = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      updateObject({ ...INITIAL_OBJECT, id: crypto.randomUUID(), kind: 'image', name: file.name, imageUrl: String(reader.result), width: 180, height: 135 })
      setSamples([])
      setTrailSamples([])
      setPhase('idle')
    }
    reader.readAsDataURL(file)
  }

  const capturedDuration = samples.at(-1)?.time ?? duration
  const keyframes = samples.length
    ? [0, .25, .5, .75, 1].map((ratio) => samples.reduce((best, sample) => Math.abs(sample.time - capturedDuration * ratio) < Math.abs(best.time - capturedDuration * ratio) ? sample : best, samples[0]))
    : []
  const curveSegments = keyframes.slice(0, -1).map((start, index) => {
    const end = keyframes[index + 1]
    return samples.filter(sample => sample.time >= start.time && sample.time <= end.time)
  })

  const copyMotionData = async () => {
    const value = keyframes.map(sample => `${sample.time.toFixed(2)}s — X ${Math.round(sample.x)}, Y ${Math.round(sample.y)}, Rotation ${Math.round(sample.rotation)}°`).join('\n')
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const captureLabel = phase === 'recording' ? 'Stop recording' : phase === 'complete' ? 'Record again' : 'Record movement'
  const elapsed = progress * duration

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><Aperture size={25} /><span>graphine</span></div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className="nav-button active" aria-label="Motion workspace"><MousePointer2 size={19} /></button>
          <button className="nav-button" aria-label="Layers"><Layers3 size={19} /></button>
          <button className="nav-button" aria-label="Projects"><Grid2X2 size={19} /></button>
        </nav>
        <div className="sidebar-bottom"><button className="nav-button"><HelpCircle size={19} /></button><button className="avatar">EM</button></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="project-title"><button className="eyebrow-button">MY PROJECTS <span>/</span></button><button className="title-button">Untitled motion <ChevronDown size={15} /></button><span className="saved-status">Saved</span></div>
          <div className="top-actions"><button className="icon-button" title="Undo"><Undo2 size={18} /></button><button className="button secondary"><Share2 size={16} /> Share</button><button className="button primary"><Download size={16} /> Export guide</button></div>
        </header>

        <div className="content-grid">
          <section className="design-panel">
            <div className="panel-heading">
              <div><p className="kicker">MOTION CANVAS</p><h1>Perform the movement.</h1></div>
              <div className="canvas-tools">
                <div className="shape-menu-wrap">
                  <button className="tool-button" onClick={() => setShowShapes(!showShapes)} disabled={phase === 'recording'}><Plus size={17} /> Shape <ChevronDown size={13} /></button>
                  {showShapes && <div className="shape-popover"><button onClick={() => addShape('square')}><Square size={18} /> Square</button><button onClick={() => addShape('circle')}><CircleIcon size={18} /> Circle</button><button onClick={() => addShape('triangle')}><Triangle size={18} /> Triangle</button></div>}
                </div>
                <button className="tool-button" onClick={() => fileInput.current?.click()} disabled={phase === 'recording'}><ImagePlus size={17} /> Import</button>
                <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event) => handleUpload(event.target.files?.[0])} />
              </div>
            </div>

            <div className={`canvas-card ${phase === 'recording' ? 'is-recording' : ''}`}>
              <div className="canvas-bar">
                <div className="object-identity"><Box size={15} /><span>{object.name}</span></div>
                <div className="stage-stats"><span>X {Math.round(object.x)}</span><span>Y {Math.round(object.y)}</span><span>{Math.round(object.rotation)}°</span></div>
              </div>
              <MotionStage object={object} onChange={updateObject} countdown={countdown} recording={phase === 'recording'} motionPath={trailSamples} />
              <div className="playback-bar capture-bar">
                <button className={`play-button ${phase === 'recording' ? 'stop' : ''}`} onClick={phase === 'recording' ? stopCapture : startCapture} disabled={phase === 'countdown'}>{phase === 'recording' ? <StopCircle size={17} /> : <Play size={17} fill="currentColor" />}</button>
                <span className="timecode">{elapsed.toFixed(1)}s</span>
                <div className="timeline"><div className="timeline-fill" style={{ width: `${progress * 100}%` }} /><span className="timeline-thumb" style={{ left: `${progress * 100}%` }} /></div>
                <span className="timecode">{duration.toFixed(1)}s</span>
                <label className="duration-control"><span>RECORD FOR</span><select value={duration} disabled={phase === 'recording' || phase === 'countdown'} onChange={(event) => setDuration(Number(event.target.value))} aria-label="Recording duration"><option value="1">1 second</option><option value="2">2 seconds</option><option value="3">3 seconds</option><option value="5">5 seconds</option><option value="8">8 seconds</option><option value="10">10 seconds</option></select></label>
                <button className={`record-button ${phase === 'recording' ? 'stop' : ''}`} onClick={phase === 'recording' ? stopCapture : startCapture} disabled={phase === 'countdown'}>{phase === 'recording' ? <StopCircle size={15} /> : <span className="record-dot" />}{captureLabel}</button>
              </div>
            </div>

            <div className="capture-help">
              <div><span>1</span><p><strong>Choose a duration</strong>Select how long you want to perform.</p></div>
              <div><span>2</span><p><strong>Press record</strong>Wait for the 3–2–1 countdown.</p></div>
              <div><span>3</span><p><strong>Move freely</strong>Drag and rotate until time runs out.</p></div>
            </div>
          </section>

          <aside className="guide-panel">
            <div className="guide-head"><div className="ai-badge"><Sparkles size={14} /> MOTION GUIDE</div><div className="tabs"><button className={activeTab === 'curves' ? 'active' : ''} onClick={() => setActiveTab('curves')}>Graphs</button><button className={activeTab === 'steps' ? 'active' : ''} onClick={() => setActiveTab('steps')}>Steps</button></div></div>

            {samples.length === 0 ? (
              <div className="empty-guide">
                <div className="empty-orbit"><WandSparkles size={25} /></div>
                <p className="kicker">WAITING FOR MOTION</p><h2>Your graphs will appear here.</h2>
                <p>Choose a duration, press record, then move and rotate the object during the capture window.</p>
                <div className="capture-signals"><span><i style={{ background: '#a7f7d2' }} /> X position</span><span><i style={{ background: '#86b7ff' }} /> Y position</span><span><i style={{ background: '#b7a5ff' }} /> Rotation</span></div>
              </div>
            ) : activeTab === 'curves' ? (
              <div className="guide-content recording-results">
                <div className="generated-title"><div><p className="kicker">CAPTURE COMPLETE</p><h2>Alight easing curves</h2><p>One curve for each pair of keyframes.</p></div><WandSparkles size={22} /></div>
                <div className="curve-channel-switch" aria-label="Curve property">
                  <button className={curveChannel === 'position' ? 'active' : ''} onClick={() => setCurveChannel('position')}><MousePointer2 size={14} /> Position</button>
                  <button className={curveChannel === 'rotation' ? 'active' : ''} onClick={() => setCurveChannel('rotation')}><RotateCw size={14} /> Rotation</button>
                </div>
                <div className="curve-explainer"><span>X</span><p><strong>Time → remapped progress</strong>The dotted line is your captured timing; the solid curve is the fitted Alight Motion curve.</p></div>
                <div className="recorded-graphs">{curveSegments.map((segment, index) => <RecordedGraph key={`${curveChannel}-${index}`} label={`Keyframe ${index + 1} → ${index + 2}`} samples={segment} channel={curveChannel} />)}</div>
                <div className="sample-summary"><div><span>DURATION</span><strong>{capturedDuration.toFixed(1)}s</strong></div><div><span>SAMPLES</span><strong>{samples.length}</strong></div><div><span>KEYFRAMES</span><strong>{keyframes.length}</strong></div></div>
                <button className="generate-button" onClick={() => setActiveTab('steps')}><Sparkles size={17} /> View Alight Motion steps</button>
              </div>
            ) : (
              <div className="guide-content steps-content">
                <div className="generated-title"><div><p className="kicker">ALIGHT MOTION</p><h2>Rebuild this motion</h2><p>Use these sampled keyframes as your guide.</p></div><Upload size={22} /></div>
                <div className="steps-list">
                  <div className="instruction"><span>00</span><div><h3>Create three property tracks</h3><p>On your layer, enable keyframes for Position X, Position Y, and Rotation.</p></div></div>
                  {keyframes.map((sample, index) => <div className="instruction" key={`${sample.time}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>At {sample.time.toFixed(2)} seconds</h3><p>Set X to {Math.round(sample.x)} px, Y to {Math.round(sample.y)} px, and Rotation to {Math.round(sample.rotation)}°.</p></div></div>)}
                </div>
                <div className="tip-card"><Sparkles size={17} /><div><strong>Apply each curve separately</strong><p>Move the playhead between each keyframe pair, open the Curve Editor, then enter the four handle values shown on its graph.</p></div></div>
                <button className="generate-button" onClick={copyMotionData}><Copy size={17} /> {copied ? 'Copied keyframes' : 'Copy keyframe values'}</button>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}

export default App

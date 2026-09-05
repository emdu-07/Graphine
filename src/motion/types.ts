export type MotionChannel = 'position' | 'rotation'

export type CapturePhase = 'idle' | 'countdown' | 'recording' | 'complete'

export interface MotionSample {
  time: number
  x: number
  y: number
  rotation: number
}

export type MotionKeyframe = MotionSample

export interface MotionCurvePoint {
  time: number
  progress: number
}

export interface MotionCurve {
  channel: MotionChannel
  segmentIndex: number
  label: string
  startTime: number
  endTime: number
  points: MotionCurvePoint[]
  cubic: [number, number, number, number]
  amount: number
}

export interface MotionGuideStep {
  id: string
  index: number
  channel?: MotionChannel
  title: string
  description: string
}

export interface MotionResult {
  duration: number
  sampleCount: number
  keyframes: Record<MotionChannel, MotionKeyframe[]>
  curves: MotionCurve[]
  steps: MotionGuideStep[]
}

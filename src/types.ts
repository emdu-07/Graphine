export type ShapeKind = 'circle' | 'square' | 'triangle' | 'image'
export type PropertyKind = 'position' | 'rotation' | 'scale'

export interface MotionObject {
  id: string
  name: string
  kind: ShapeKind
  x: number
  y: number
  startX: number
  startY: number
  width: number
  height: number
  rotation: number
  fill: string
  imageUrl?: string
}

export interface MotionSample {
  time: number
  x: number
  y: number
  rotation: number
}

export interface CurvePreset {
  id: string
  name: string
  subtitle: string
  path: string
  cubic: [number, number, number, number]
  accent: string
}

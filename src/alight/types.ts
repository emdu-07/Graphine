/** XML paths are occurrence-based, so repeated effect IDs remain distinguishable. */
export interface SourceRef {
  element: string
  path: string
  id?: string
  propertyName?: string
  effectId?: string
  line: number
  column: number
}

export interface XmlElement {
  source: SourceRef
  attributes: Record<string, string>
  children: XmlElement[]
  text: string
}

export interface Sourced {
  source: SourceRef
  raw: XmlElement
}

export interface Diagnostic {
  code: string
  message: string
  source?: SourceRef
  attribute?: string
}

export interface AnimationValue {
  source: SourceRef
  type: string
  raw?: string
  /** null means absent or invalid, never a substituted default. */
  value: number | boolean | string | number[] | null
}

export interface AnimationEasing {
  source: SourceRef
  kind: 'cubicBezier' | 'elastic' | 'unknown'
  name: string
  raw: string
  rawParameters: string[]
  parameters: (number | null)[]
}

export interface AnimationKeyframe extends Sourced {
  /** Source coordinates only. Interpretation belongs to resolveTimeline. */
  timing: {
    sourceT?: string
    sourceValue: number | null
  }
  value: AnimationValue
  easing?: AnimationEasing
  propertyPath: string
}

export interface AnimationProperty extends Sourced {
  name: string
  type: string
  staticValue?: AnimationValue
  keyframes: AnimationKeyframe[]
  unknownElements: XmlElement[]
}

export interface AnimationEffect extends Sourced {
  id?: string
  locallyApplied?: boolean
  properties: AnimationProperty[]
  unknownElements: XmlElement[]
}

export interface AnimationTransform extends Sourced {
  /** Includes location, scale, rotation, opacity, pivot, and unknown channels. */
  properties: AnimationProperty[]
}

export interface LayerTiming extends Sourced {
  /** Scene-local milliseconds. Missing attributes remain undefined. */
  startTime?: number
  endTime?: number
  inTime?: number
  outTime?: number
  speed?: number
}

export interface AnimationLayer extends Sourced {
  kind: 'shape' | 'media' | 'null' | 'embedded' | 'unknown'
  id?: string
  label?: string
  hidden?: boolean
  scenePath: string
  parentId?: string
  timing: LayerTiming
  fillType?: string
  /** Exact media attribute names and URIs; no file access or media decoding. */
  media: Record<string, string>
  shapeType?: string
  blending?: string
  /** Explicit mask/group attributes only; no inferred mask targets. */
  maskGroupAttributes: Record<string, string>
  transforms: AnimationTransform[]
  /** Includes shape size, radius, fillColor, gain, and all generic properties. */
  properties: AnimationProperty[]
  effects: AnimationEffect[]
  scenes: AnimationScene[]
  unknownElements: XmlElement[]
}

export interface AnimationBookmark extends Sourced {
  rawTime?: string
  time: number | null
}

export interface AnimationScene extends Sourced {
  id?: string
  title?: string
  width?: number
  height?: number
  exportWidth?: number
  exportHeight?: number
  fps?: number
  totalTime?: number
  metadata: Record<string, string>
  parentScenePath?: string
  ownerLayerPath?: string
  ownerLayerId?: string
  bookmarks: AnimationBookmark[]
  layers: AnimationLayer[]
  /** Direct nested scene declarations, distinct from layer-owned embedded scenes. */
  scenes: AnimationScene[]
  unknownElements: XmlElement[]
}

export interface AnimationProject extends AnimationScene {
  /** Original document retained verbatim, including lexical attribute spellings. */
  sourceXml: string
}

export interface AlightParseResult {
  project: AnimationProject | null
  warnings: Diagnostic[]
  errors: Diagnostic[]
}

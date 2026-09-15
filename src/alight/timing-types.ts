import type { SourceRef } from './types.ts'

/** Exact means deterministic arithmetic under the stated policy, not renderer verification. */
export interface TimeValue {
  value: number | null
  resolution: 'exact' | 'unresolved'
  basis: 'source' | 'derived'
  rule: string
  reason?: string
}

export interface TimeInterval {
  start: TimeValue
  end: TimeValue
}

export interface TimingPolicy {
  id: string
  /** XML does not declare the coordinate system of kf.t. */
  keyframeBasis: 'unresolved' | 'layer-duration'
  embeddedMapping: 'unresolved' | 'affine'
  omittedSpeed?: 1
  omittedInTime?: 0
  /** Missing retime is not the same thing as explicit retime="off". */
  allowOmittedRetime?: boolean
  /** Must be reviewed separately for projects with retimed property tracks. */
  retimedProperties?: 'layer-duration'
}

export interface ResolvedSceneTiming {
  source: SourceRef
  ownerLayerPath?: string
  localInterval: TimeInterval
  projectInterval: TimeInterval
}

export interface ResolvedLayerTiming {
  source: SourceRef
  scenePath: string
  parentId?: string
  sceneInterval: TimeInterval
  projectInterval: TimeInterval
  /** Source-content coordinates at the two layer boundaries, not property progress. */
  contentInterval: TimeInterval | null
}

export interface ResolvedKeyframeTiming {
  source: SourceRef
  layerPath: string
  scenePath: string
  propertyPath: string
  sourceT?: string
  sourceValue: number | null
  localProgress: TimeValue
  /** Offset from layer start, before adding the scene-local startTime. */
  localTimeMs: TimeValue
  sceneTimeMs: TimeValue
  projectTimeMs: TimeValue
  resolution: 'exact' | 'unresolved'
  classification: 'within-layer' | 'outside-layer' | 'unresolved' | 'malformed'
  /** This is a coordinate range check, not a claim that the layer is rendered. */
  withinLayerInterval: boolean | null
}

export interface TimelineDiagnostic {
  code: string
  message: string
  source?: SourceRef
}

export interface ResolvedTimeline {
  policy: TimingPolicy
  /** No XML-only policy is renderer verified in this phase. */
  evidence: 'xml-only'
  scenes: ResolvedSceneTiming[]
  layers: ResolvedLayerTiming[]
  keyframes: ResolvedKeyframeTiming[]
  diagnostics: TimelineDiagnostic[]
}

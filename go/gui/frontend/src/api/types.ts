import type * as Native from '../../bindings/github.com/the1812/Touhou-Tagger/go/gui/internal/bridge/models.js'

export type NarrowSlices<T> =
  Exclude<T, null> extends readonly (infer Item)[]
    ? NarrowSlices<Item>[]
    : T extends object
      ? { [Key in keyof T]: NarrowSlices<T[Key]> }
      : T

export type ErrorInfo = NarrowSlices<Native.ErrorInfo>
export type ErrorParams = NarrowSlices<Native.ErrorParams>
export type StateIssue = NarrowSlices<Native.StateIssue>
export type SourceOption = NarrowSlices<Native.SourceOption>
export type SelectOption = NarrowSlices<Native.SelectOption>
export type Capabilities = NarrowSlices<Native.Capabilities>
export type CoverStatus = NarrowSlices<Native.CoverStatus>
export type WorkspaceSummary = NarrowSlices<Native.WorkspaceSummary>
export type AlbumCandidate = NarrowSlices<Native.AlbumCandidate>
export type AlbumMetadata = NarrowSlices<Native.AlbumMetadata>
export type CoverPreview = NarrowSlices<Native.CoverPreview>
export type PlanItemPreview = NarrowSlices<Native.PlanItemPreview>
export type PlanOptions = NarrowSlices<Native.PlanOptions>
export type PlanPreview = NarrowSlices<Native.PlanPreview>

export type AlbumMetadataPatch = Native.AlbumMetadataPatch
export type TrackMetadataPatch = Native.TrackMetadataPatch
export type PlanPatch = Native.PlanPatch
export type Settings = NarrowSlices<Native.Settings>
export type OperationStart = Native.OperationStart

export type OperationKind = 'workspace' | 'batch'

export type OperationStage =
  | 'preparing'
  | 'writing'
  | 'renaming'
  | 'complete'
  | 'cancelled'
  | 'failed'

export interface OperationProgress {
  operationId: string
  kind: OperationKind
  stage: OperationStage
  current: number
  total: number
  path?: string
  message: string
  messageId?: string
  cancellable: boolean
}

interface OperationCounts {
  operationId: string
  succeeded: number
  failed: number
  renamed: number
  coversSaved: number
  lrcFiles: number
  durationMs: number
  cancelled: boolean
  message: string
}

export interface WorkspaceOperationResult extends OperationCounts {
  kind: 'workspace'
  plan?: PlanPreview | null
}

export interface BatchRunResult extends OperationCounts {
  kind: 'batch'
  jobs: BatchJobPreview[]
}

export type OperationResult = WorkspaceOperationResult | BatchRunResult

export interface OperationFailure {
  plan?: PlanPreview | null
  error?: ErrorInfo | null
  operationId: string
  kind: OperationKind
  message: string
  details?: string
  planInvalidated: boolean
}

export type BatchJobReadiness = 'pending' | 'ready' | 'needs-candidate' | 'blocked' | 'skipped'
export type BatchJobOutcome = 'succeeded' | 'failed' | 'cancelled'

export type BatchJobPreview = Omit<
  NarrowSlices<Native.BatchJobPreview>,
  'readiness' | 'outcome'
> & {
  readiness: BatchJobReadiness
  outcome?: BatchJobOutcome
}

export type BatchPreview = Omit<NarrowSlices<Native.BatchPreview>, 'jobs'> & {
  jobs: BatchJobPreview[]
}

export type * from './contracts'

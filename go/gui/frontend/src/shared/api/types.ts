import type * as Native from '../../../bindings/github.com/the1812/Touhou-Tagger/go/gui/internal/bridge/models.js'
import type * as Domain from '../../../bindings/github.com/the1812/Touhou-Tagger/go/internal/domain/models.js'

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

export type TrackMetadata = NarrowSlices<Native.TrackMetadata>
export type MetadataConfig = Omit<Domain.MetadataConfig, 'lyric'> & { lyric: Domain.LyricConfig }

export type WriteOperationKind = 'workspace' | 'batch'

export type WriteOperationStage =
  | 'preparing'
  | 'writing'
  | 'renaming'
  | 'complete'
  | 'cancelled'
  | 'failed'

export interface WriteOperationProgress {
  operationId: string
  kind: WriteOperationKind
  stage: WriteOperationStage
  current: number
  total: number
  path?: string
  message: string
  messageId?: string
  cancellable: boolean
}

interface WriteOperationCounts {
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

export interface WorkspaceWriteOperationResult extends WriteOperationCounts {
  kind: 'workspace'
  plan?: PlanPreview | null
}

export interface BatchRunResult extends WriteOperationCounts {
  kind: 'batch'
  entries: BatchEntryPreview[]
}

export type WriteOperationResult = WorkspaceWriteOperationResult | BatchRunResult

export interface WriteOperationFailure {
  plan?: PlanPreview | null
  error?: ErrorInfo | null
  operationId: string
  kind: WriteOperationKind
  message: string
  details?: string
}

export type BatchEntryReadiness = 'pending' | 'ready' | 'needs-candidate' | 'blocked' | 'skipped'
export type BatchEntryOutcome = 'succeeded' | 'failed' | 'cancelled'

export type BatchEntryPreview = Omit<
  NarrowSlices<Native.BatchEntryPreview>,
  'readiness' | 'outcome'
> & {
  readiness: BatchEntryReadiness
  outcome?: BatchEntryOutcome
}

export type BatchPreview = Omit<NarrowSlices<Native.BatchPreview>, 'entries'> & {
  entries: BatchEntryPreview[]
}

export type * from './contracts'

export {
  LyricOutput,
  LyricType,
} from '../../../bindings/github.com/the1812/Touhou-Tagger/go/internal/domain/models.js'

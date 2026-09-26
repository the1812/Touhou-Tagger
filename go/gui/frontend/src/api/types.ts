export interface ErrorInfo {
  code: string
  params?: { files: number; tracks: number }
  message: string
  details: string
}

export type IssueSeverity = 'warning' | 'error'

export interface StateIssue {
  error?: ErrorInfo
  code: string
  message: string
  severity: IssueSeverity
  itemId?: string
}

export interface SourceOption {
  value: string
  label: string
  supportsSearch: boolean
}

export interface SelectOption {
  value: string
  label: string
}

export interface Capabilities {
  sources: SourceOption[]
  commentLanguages: SelectOption[]
  lyricTypes: SelectOption[]
}

export interface CoverStatus {
  exists: boolean
  valid: boolean
  fileName?: string
  issue?: StateIssue
}

export interface WorkspaceSummary {
  directory: string
  audioCount: number
  mp3Count: number
  flacCount: number
  localCover: CoverStatus
  hasMetadataJson: boolean
  hasAlbumConfig: boolean
  inferredAlbumName: string
  effectiveSource: string
  issues: StateIssue[]
}

export interface AlbumCandidate {
  id: string
  title: string
  source: string
  sourceLabel: string
  albumOrder?: string
  artists: string[]
  thumbnailUrl?: string
  year?: string
  exactMatch: boolean
  description?: string
}

export interface AlbumMetadata {
  title: string
  albumOrder: string
  artists: string[]
  year: string
  genres: string[]
}

export type CoverSource = 'local' | 'thb-wiki' | 'doujin-meta' | 'music-brainz' | 'discogs' | 'none'

export interface CoverPreview {
  url: string
  source: CoverSource
  sourceLabel: string
  width: number
  height: number
  byteSize: number
  compressionDescription: string
  issue?: StateIssue
}

export interface PlanItemPreview {
  id: string
  sourceName: string
  format: string
  discNumber: string
  trackNumber: string
  title: string
  artists: string[]
  comments: string
  targetName: string
  willRename: boolean
  issues: StateIssue[]
}

export interface PlanOptions {
  writeFiles: number
  renameFiles: number
  canSaveCover: boolean
  saveCover: boolean
  compressCover: boolean
  lrcFiles: number
}

export interface PlanPreview {
  planId: string
  revision: number
  directory: string
  album: AlbumMetadata
  candidate: AlbumCandidate
  cover: CoverPreview
  items: PlanItemPreview[]
  issues: StateIssue[]
  options: PlanOptions
  canCommit: boolean
}

export interface AlbumMetadataPatch {
  title?: string
  albumOrder?: string
  artists?: string[]
  year?: string
  genres?: string[]
}

export interface TrackMetadataPatch {
  id: string
  discNumber?: string
  trackNumber?: string
  title?: string
  artists?: string[]
  comments?: string
}

export interface PlanPatch {
  planId: string
  revision: number
  album?: AlbumMetadataPatch
  tracks?: TrackMetadataPatch[]
  saveCover?: boolean
}

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

export interface OperationStart {
  operationId: string
}

export interface OperationResult {
  plan?: PlanPreview
  operationId: string
  kind: OperationKind
  succeeded: number
  failed: number
  renamed: number
  coversSaved: number
  lrcFiles: number
  durationMs: number
  cancelled: boolean
  message: string
}

export interface OperationFailure {
  plan?: PlanPreview
  error?: ErrorInfo
  operationId: string
  kind: OperationKind
  message: string
  details?: string
  planInvalidated: boolean
}
export type * from './batchTypes'
export type * from './contracts'

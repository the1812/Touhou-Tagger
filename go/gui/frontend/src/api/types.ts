export type IssueSeverity = 'warning' | 'error'

export interface StateIssue {
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

export type CoverSource = 'local' | 'thb-wiki' | 'doujin-meta' | 'none'

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
  | 'committing'
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
  cancellable: boolean
}

export interface OperationStart {
  operationId: string
}

export interface OperationResult {
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
  operationId: string
  kind: OperationKind
  message: string
  details?: string
  planInvalidated: boolean
}

export type BatchJobStatus =
  | 'ready'
  | 'needs-candidate'
  | 'local-metadata'
  | 'track-mismatch'
  | 'scan-failed'
  | 'ignored'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface BatchJobPreview {
  id: string
  relativePath: string
  inferredAlbumName: string
  source: string
  matchDescription: string
  audioCount: number
  status: BatchJobStatus
  issues: StateIssue[]
  candidates: AlbumCandidate[]
  selectedCandidateId?: string
}

export interface BatchPreview {
  batchId: string
  rootDirectory: string
  depth: number
  jobs: BatchJobPreview[]
}

export interface BatchRunResult extends OperationResult {
  jobs: BatchJobPreview[]
}

export interface Settings {
  defaultSource: string
  commentLanguage: string
  mp3MultiValueSeparator: string
  requestTimeoutSeconds: number
  retryCount: number
  coverCompressionThresholdKb: number
  coverMaxEdge: number
  lyricType: string
  writeLyricsMetadata: boolean
  writeLrcFiles: boolean
  preserveLyricTimeline: boolean
  mixedLyricSeparator: string
  lyricCacheSize: number
}

export interface ProcessError {
  message: string
  details?: string
}

export interface SettingsApi {
  getCapabilities(): Promise<Capabilities>
  loadSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<Settings>
  resetSettings(): Promise<Settings>
}

export interface WorkspaceApi {
  selectAlbumDirectory(): Promise<string>
  scanWorkspace(directory: string): Promise<WorkspaceSummary>
  searchAlbums(directory: string, query: string, source: string): Promise<AlbumCandidate[]>
  preparePlan(directory: string, candidateId: string, source: string): Promise<PlanPreview>
  updatePlan(patch: PlanPatch): Promise<PlanPreview>
  discardPlan(planId: string): Promise<void>
  commitPlan(planId: string, revision: number): Promise<OperationStart>
  startOperation(operationId: string): Promise<void>
  cancelOperation(operationId: string): Promise<void>
}

export interface DesktopApi {
  getStartupDirectory(): Promise<string>
  revealDirectory(directory: string): Promise<void>
}

export interface BatchApi {
  selectBatchDirectory(): Promise<string>
  scanBatch(directory: string, depth: number, source: string): Promise<BatchPreview>
  resolveBatchCandidate(
    batchId: string,
    jobId: string,
    candidateId: string,
  ): Promise<BatchJobPreview>
  ignoreBatchJob(batchId: string, jobId: string): Promise<BatchJobPreview>
  discardBatch(batchId: string): Promise<void>
  runBatch(batchId: string, failedOnly: boolean): Promise<OperationStart>
  startBatch(operationId: string): Promise<void>
  cancelBatch(operationId: string): Promise<void>
}

export interface OperationEventsApi {
  onProgress(handler: (progress: OperationProgress) => void): () => void
  onComplete(handler: (result: OperationResult | BatchRunResult) => void): () => void
  onFailure(handler: (failure: OperationFailure) => void): () => void
  onProcessError(handler: (error: ProcessError) => void): () => void
}

export type GUIApi = SettingsApi & WorkspaceApi & DesktopApi & BatchApi & OperationEventsApi

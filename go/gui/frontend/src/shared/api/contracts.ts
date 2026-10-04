import type {
  AlbumCandidate,
  BatchEntryPreview,
  BatchPreview,
  Capabilities,
  WriteOperationProgress,
  WorkspaceWriteOperationResult,
  BatchRunResult,
  AlbumMetadata,
  TrackMetadata,
  PlanPreview,
  MetadataConfig,
  WorkspaceSummary,
  DumpSummary,
  DumpResult,
} from './types'

export interface SettingsApi {
  getCapabilities(): Promise<Capabilities>
  loadSettings(): Promise<MetadataConfig>
  saveSettings(settings: MetadataConfig): Promise<MetadataConfig>
  resetSettings(): Promise<MetadataConfig>
}

export interface WorkspaceApi {
  selectAlbumDirectory(title: string): Promise<string>
  scanWorkspace(directory: string): Promise<WorkspaceSummary>
  searchAlbums(directory: string, query: string, source: string): Promise<AlbumCandidate[]>
  preparePlan(directory: string, candidateId: string, source: string): Promise<PlanPreview>
  updateAlbum(planId: string, album: AlbumMetadata): Promise<PlanPreview>
  updateTrack(planId: string, trackId: string, track: TrackMetadata): Promise<PlanPreview>
  setSaveCover(planId: string, enabled: boolean): Promise<PlanPreview>
  discardPlan(planId: string): Promise<void>
  executePlan(planId: string, operationId: string): Promise<WorkspaceWriteOperationResult>
  cancelWriteOperation(operationId: string): Promise<void>
}

export interface DesktopApi {
  onDirectoriesDrop(handler: (directories: string[]) => void): () => void
  revealDirectory(directory: string): Promise<void>
  setDarkMode(dark: boolean): Promise<void>
}

export interface BatchApi {
  selectBatchDirectory(title: string): Promise<string>
  scanBatchDirectories(directory: string, depth: number, source: string): Promise<BatchPreview>
  selectMultipleDirectories(title: string): Promise<string[]>
  createBatchFromDirectories(directories: string[], source: string): Promise<BatchPreview>
  addBatchDirectories(batchId: string, directories: string[]): Promise<BatchPreview>
  removeBatchEntry(batchId: string, entryId: string): Promise<BatchPreview>
  loadBatchEntry(batchId: string, entryId: string): Promise<BatchEntryPreview>
  resolveBatchCandidate(
    batchId: string,
    entryId: string,
    candidateId: string,
  ): Promise<BatchEntryPreview>
  discardBatch(batchId: string): Promise<void>
  executeBatch(batchId: string, failedOnly: boolean, operationId: string): Promise<BatchRunResult>
  cancelBatch(operationId: string): Promise<void>
}

export interface WriteOperationEventsApi {
  onProgress(handler: (progress: WriteOperationProgress) => void): () => void
}

export interface DumpApi {
  scanDump(directory: string): Promise<DumpSummary>
  selectDumpOutput(directory: string, saveAs: boolean): Promise<string>
  dumpMetadata(directory: string, path: string): Promise<DumpResult>
}

export type GUIApi = SettingsApi &
  WorkspaceApi &
  DesktopApi &
  BatchApi &
  WriteOperationEventsApi &
  DumpApi

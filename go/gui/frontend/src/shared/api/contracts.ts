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
  onDirectoryDrop(handler: (directory: string) => void): () => void
  revealDirectory(directory: string): Promise<void>
  setDarkMode(dark: boolean): Promise<void>
}

export interface BatchApi {
  selectBatchDirectory(title: string): Promise<string>
  scanBatch(directory: string, depth: number, source: string): Promise<BatchPreview>
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

export type GUIApi = SettingsApi & WorkspaceApi & DesktopApi & BatchApi & WriteOperationEventsApi

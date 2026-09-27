import type {
  AlbumCandidate,
  BatchJobPreview,
  BatchPreview,
  Capabilities,
  OperationFailure,
  OperationProgress,
  OperationResult,
  OperationStart,
  PlanPatch,
  PlanPreview,
  Settings,
  WorkspaceSummary,
} from './types'

export interface SettingsApi {
  getCapabilities(): Promise<Capabilities>
  loadSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<Settings>
  resetSettings(): Promise<Settings>
}

export interface WorkspaceApi {
  selectAlbumDirectory(title: string): Promise<string>
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
  onDirectoryDrop(handler: (directory: string) => void): () => void
  getStartupDirectory(): Promise<string>
  revealDirectory(directory: string): Promise<void>
  setDarkMode(dark: boolean): Promise<void>
}

export interface BatchApi {
  selectBatchDirectory(title: string): Promise<string>
  scanBatch(directory: string, depth: number, source: string): Promise<BatchPreview>
  loadBatchJob(batchId: string, jobId: string): Promise<BatchJobPreview>
  resolveBatchCandidate(
    batchId: string,
    jobId: string,
    candidateId: string,
  ): Promise<BatchJobPreview>
  discardBatch(batchId: string): Promise<void>
  runBatch(batchId: string, failedOnly: boolean): Promise<OperationStart>
  startBatch(operationId: string): Promise<void>
  cancelBatch(operationId: string): Promise<void>
}

export interface OperationEventsApi {
  onProgress(handler: (progress: OperationProgress) => void): () => void
  onComplete(handler: (result: OperationResult) => void): () => void
  onFailure(handler: (failure: OperationFailure) => void): () => void
}

export type GUIApi = SettingsApi & WorkspaceApi & DesktopApi & BatchApi & OperationEventsApi

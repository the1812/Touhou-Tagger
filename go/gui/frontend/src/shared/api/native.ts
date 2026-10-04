import { Events } from '@wailsio/runtime'

import {
  AppearanceService,
  DumpService,
  BatchService,
  SettingsService,
  WorkspaceService,
} from '../../../bindings/github.com/the1812/Touhou-Tagger/go/gui/internal/bridge/index.js'
import type {
  AlbumCandidate,
  BatchEntryPreview,
  BatchPreview,
  Capabilities,
  GUIApi,
  MetadataConfig,
  WriteOperationProgress,
  WorkspaceWriteOperationResult,
  BatchRunResult,
  PlanPreview,
  WorkspaceSummary,
} from './types'

export const nativeApi: GUIApi = {
  scanDump: directory => DumpService.Scan(directory),
  selectDumpOutput: (directory, saveAs) => DumpService.SelectOutput(directory, saveAs),
  dumpMetadata: (directory, path) => DumpService.Extract(directory, path),
  setDarkMode: dark => AppearanceService.SetDarkMode(dark),
  getCapabilities: async () => (await SettingsService.GetCapabilities()) as Capabilities,
  onDirectoriesDrop: handler =>
    Events.On('gui:directories-dropped', event => handler(event.data as string[])),
  selectAlbumDirectory: title => WorkspaceService.SelectAlbumDirectory(title),
  scanWorkspace: async directory =>
    (await WorkspaceService.ScanWorkspace(directory)) as WorkspaceSummary,
  searchAlbums: async (directory, query, source) =>
    (await WorkspaceService.SearchAlbums(directory, query, source)) as AlbumCandidate[],
  preparePlan: async (directory, candidateId, source) =>
    (await WorkspaceService.PreparePlan(directory, candidateId, source)) as PlanPreview,
  updateAlbum: async (planId, album) =>
    (await WorkspaceService.UpdateAlbum(planId, album)) as PlanPreview,
  updateTrack: async (planId, trackId, track) =>
    (await WorkspaceService.UpdateTrack(planId, trackId, track)) as PlanPreview,
  setSaveCover: async (planId, enabled) =>
    (await WorkspaceService.SetSaveCover(planId, enabled)) as PlanPreview,
  async discardPlan(planId) {
    await WorkspaceService.DiscardPlan(planId)
  },
  executePlan: async (planId, operationId) =>
    (await WorkspaceService.ExecutePlan(planId, operationId)) as WorkspaceWriteOperationResult,
  async cancelWriteOperation(operationId) {
    await WorkspaceService.CancelWriteOperation(operationId)
  },
  revealDirectory: directory => WorkspaceService.RevealDirectory(directory),
  selectBatchDirectory: title => BatchService.SelectBatchDirectory(title),
  scanBatchDirectories: async (directory, depth, source) =>
    (await BatchService.ScanBatchDirectories(directory, depth, source)) as BatchPreview,
  selectMultipleDirectories: async title =>
    (await BatchService.SelectMultipleDirectories(title)) ?? [],
  createBatchFromDirectories: async (directories, source) =>
    (await BatchService.CreateBatchFromDirectories(directories, source)) as BatchPreview,
  addBatchDirectories: async (batchId, directories) =>
    (await BatchService.AddBatchDirectories(batchId, directories)) as BatchPreview,
  removeBatchEntry: async (batchId, entryId) =>
    (await BatchService.RemoveBatchEntry(batchId, entryId)) as BatchPreview,
  loadBatchEntry: async (batchId, entryId) =>
    (await BatchService.LoadBatchEntry(batchId, entryId)) as BatchEntryPreview,
  resolveBatchCandidate: async (batchId, entryId, candidateId) =>
    (await BatchService.ResolveBatchCandidate(batchId, entryId, candidateId)) as BatchEntryPreview,
  discardBatch: batchId => BatchService.DiscardBatch(batchId),
  executeBatch: async (batchId, failedOnly, operationId) =>
    (await BatchService.ExecuteBatch(batchId, failedOnly, operationId)) as BatchRunResult,
  async cancelBatch(operationId) {
    await BatchService.CancelBatch(operationId)
  },
  loadSettings: async () => (await SettingsService.LoadSettings()) as MetadataConfig,
  saveSettings: async settings => (await SettingsService.SaveSettings(settings)) as MetadataConfig,
  resetSettings: async () => (await SettingsService.ResetSettings()) as MetadataConfig,
  onProgress(handler) {
    return Events.On('gui:write-operation-progress', event =>
      handler(event.data as WriteOperationProgress),
    )
  },
}

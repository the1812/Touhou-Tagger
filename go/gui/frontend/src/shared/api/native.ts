import { Events } from '@wailsio/runtime'

import {
  AppearanceService,
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
  WriteOperationProgress,
  WorkspaceWriteOperationResult,
  BatchRunResult,
  PlanPreview,
  WorkspaceSummary,
} from './types'

export const nativeApi: GUIApi = {
  setDarkMode: dark => AppearanceService.SetDarkMode(dark),
  getCapabilities: async () => (await SettingsService.GetCapabilities()) as Capabilities,
  onDirectoryDrop: handler =>
    Events.On('gui:directory-dropped', event => handler(event.data as string)),
  selectAlbumDirectory: title => WorkspaceService.SelectAlbumDirectory(title),
  scanWorkspace: async directory =>
    (await WorkspaceService.ScanWorkspace(directory)) as WorkspaceSummary,
  searchAlbums: async (directory, query, source) =>
    (await WorkspaceService.SearchAlbums(directory, query, source)) as AlbumCandidate[],
  preparePlan: async (directory, candidateId, source) =>
    (await WorkspaceService.PreparePlan(directory, candidateId, source)) as PlanPreview,
  updatePlan: async patch => (await WorkspaceService.UpdatePlan(patch)) as PlanPreview,
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
  scanBatch: async (directory, depth, source) =>
    (await BatchService.ScanBatch(directory, depth, source)) as BatchPreview,
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
  loadSettings: () => SettingsService.LoadSettings(),
  saveSettings: settings => SettingsService.SaveSettings(settings),
  resetSettings: () => SettingsService.ResetSettings(),
  onProgress(handler) {
    return Events.On('gui:write-operation-progress', event =>
      handler(event.data as WriteOperationProgress),
    )
  },
}

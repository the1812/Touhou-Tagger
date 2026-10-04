import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  useNotificationsStore,
  useWriteOperationsStore,
  useSettingsStore,
} from '../../../entities/session'
import { getApi } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { useBatchDirectoryScan } from './directoryScan'
import { useBatchManualSelection } from './manualSelection'
import { useBatchSession } from './session'

export type BatchMode = 'directoryScan' | 'manualSelection'

export const useBatchStore = defineStore('batch', () => {
  const mode = ref<BatchMode>('directoryScan')
  const choosingMode = ref(true)
  const operations = useWriteOperationsStore()
  const settings = useSettingsStore()
  const notifications = useNotificationsStore()
  const writeLocked = computed(() => operations.isWriting)
  const directoryScan = useBatchSession(writeLocked)
  const manualSelection = useBatchSession(writeLocked)
  const current = computed(() => (mode.value === 'directoryScan' ? directoryScan : manualSelection))
  const defaultSource = () => settings.saved?.source ?? 'thb-wiki'
  const scanActions = useBatchDirectoryScan(directoryScan, defaultSource)
  const selectionActions = useBatchManualSelection(manualSelection, defaultSource)
  const preview = computed({
    get: () => current.value.preview.value,
    set: value => {
      current.value.preview.value = value
    },
  })
  const selecting = computed(() => current.value.activity.value === 'selecting')
  const scanning = computed(() => current.value.activity.value === 'scanning')
  const isWriting = computed(() => operations.activeKind === 'batch')
  const operation = computed(() => (isWriting.value ? operations.operation : undefined))
  const canChangeDirectory = computed(() => !current.value.isBusy.value)
  const canEditEntries = computed(
    () => !scanning.value && current.value.activity.value !== 'updating' && !writeLocked.value,
  )
  const canRemoveEntries = computed(
    () => canEditEntries.value && current.value.entries.resolvingCount.value === 0,
  )
  const canSwitchMode = computed(
    () => !writeLocked.value && !directoryScan.activity.value && !manualSelection.activity.value,
  )
  const readyCount = computed(() => current.value.readyCount.value)
  const skippedCount = computed(() => (preview.value?.entries.length ?? 0) - readyCount.value)
  const retryableCount = computed(() => current.value.retryableCount.value)
  const isBusy = computed(() => directoryScan.isBusy.value || manualSelection.isBusy.value)
  const canRun = computed(() => readyCount.value > 0 && !isBusy.value && !operations.isActive)

  const selectDirectory = (target?: string) =>
    mode.value === 'directoryScan'
      ? scanActions.selectDirectory(target)
      : selectionActions.addDirectories(target ? [target] : undefined)
  const chooseMode = async (value: BatchMode) => {
    if (!canSwitchMode.value) {
      return
    }
    mode.value = value
    choosingMode.value = false
    if (!current.value.preview.value) {
      await selectDirectory()
    }
  }
  const backToSelection = () => {
    if (canSwitchMode.value) {
      choosingMode.value = true
    }
  }
  const openDirectories = async (directories?: string[]) => {
    if (!directories) {
      if (choosingMode.value) {
        await chooseMode(mode.value)
      } else {
        await selectDirectory()
      }
      return
    }
    if (directories.length === 0 || !canSwitchMode.value) {
      return
    }
    const targetMode = directories.length === 1 ? 'directoryScan' : 'manualSelection'
    const session = targetMode === 'directoryScan' ? directoryScan : manualSelection
    if (session.isBusy.value) {
      return
    }
    mode.value = targetMode
    choosingMode.value = false
    if (targetMode === 'directoryScan') {
      await scanActions.selectDirectory(directories[0])
    } else {
      await selectionActions.addDirectories(directories)
    }
  }
  const refresh = () =>
    mode.value === 'directoryScan' ? scanActions.scan() : selectionActions.refresh()
  const run = async (failedOnly = false, session = current.value) => {
    const batch = session.preview.value
    const count = failedOnly ? session.retryableCount.value : session.readyCount.value
    if (!batch || isBusy.value || count === 0) {
      return
    }
    const directory = session === directoryScan ? scanActions.directory.value : undefined
    const retry = {
      disabled: () =>
        session.preview.value?.batchId !== batch.batchId ||
        session.retryableCount.value === 0 ||
        isBusy.value ||
        operations.isActive,
      run: () => {
        void run(true, session)
      },
    }
    await operations.run({
      kind: 'batch',
      execute: id => getApi().then(api => api.executeBatch(batch.batchId, failedOnly, id)),
      cancel: id => getApi().then(api => api.cancelBatch(id)),
      initial: operationId => ({
        operationId,
        kind: 'batch',
        stage: 'preparing',
        current: 0,
        total: count,
        message: t('notifications.preparingBatchWrite'),
        cancellable: false,
      }),
      complete: result => {
        session.preview.value = { ...batch, entries: result.entries }
        notifications.complete(
          result,
          directory,
          session.retryableCount.value > 0 ? retry : undefined,
        )
      },
      failure: failure => {
        notifications.error(t('notifications.batchWriteFailed'), failure.error ?? failure, {
          diagnostics: failure.details,
          directory,
          retry: session.retryableCount.value > 0 ? retry : undefined,
        })
      },
    })
  }
  const reveal = async (directory = scanActions.directory.value) => {
    if (!directory) {
      return
    }
    try {
      await (await getApi()).revealDirectory(directory)
    } catch (error) {
      notifications.error(t('notifications.revealDirectoryFailed'), error)
    }
  }

  return {
    mode,
    choosingMode,
    directory: scanActions.directory,
    depth: scanActions.depth,
    preview,
    selecting,
    scanning,
    operation,
    isWriting,
    isBusy,
    readyCount,
    skippedCount,
    retryableCount,
    canRun,
    canChangeDirectory,
    canEditEntries,
    canRemoveEntries,
    canSwitchMode,
    chooseMode,
    backToSelection,
    openDirectories,
    selectDirectory,
    refresh,
    scan: scanActions.scan,
    setDepth: scanActions.setDepth,
    addDirectories: selectionActions.addDirectories,
    removeEntry: selectionActions.removeEntry,
    loadEntry: (entryId: string) => current.value.entries.loadEntry(entryId),
    resolveCandidate: (entryId: string, candidateId: string) =>
      current.value.entries.resolveCandidate(entryId, candidateId),
    isResolving: (entryId: string) => current.value.entries.isResolving(entryId),
    run,
    cancel: operations.cancel,
    reveal,
  }
})

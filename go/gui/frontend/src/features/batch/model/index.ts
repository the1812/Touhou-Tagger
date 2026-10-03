import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import {
  useNotificationsStore,
  useWriteOperationsStore,
  useSettingsStore,
} from '../../../entities/session'
import {
  getApi,
  type BatchPreview,
  type BatchRunResult,
  type WriteOperationFailure,
} from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { useBatchEntries } from './entries'

export type BatchCompletion =
  | { kind: 'result'; result: BatchRunResult }
  | { kind: 'failure'; failure: WriteOperationFailure }

type BatchActivity = 'selecting' | 'scanning'

export const useBatchStore = defineStore('batch', () => {
  const directory = ref('')
  const depth = ref(1)
  const preview = shallowRef<BatchPreview>()
  const activity = ref<BatchActivity>()
  const completion = ref<BatchCompletion>()
  const notifications = useNotificationsStore()
  const operations = useWriteOperationsStore()
  const settings = useSettingsStore()
  const selecting = computed(() => activity.value === 'selecting')
  const scanning = computed(() => activity.value === 'scanning')
  const operation = computed(() =>
    operations.activeKind === 'batch' ? operations.operation : undefined,
  )
  const isWriting = computed(() => operations.activeKind === 'batch')
  const writeLocked = computed(() => operations.isActive)
  const entries = useBatchEntries({ preview, activity, writeLocked })
  const { resolvingCount } = entries
  const readyCount = computed(
    () => preview.value?.entries.filter(entry => entry.readiness === 'ready').length ?? 0,
  )
  const skippedCount = computed(() => (preview.value?.entries.length ?? 0) - readyCount.value)
  const retryableCount = computed(
    () =>
      preview.value?.entries.filter(
        entry => entry.readiness === 'ready' && entry.outcome === 'failed',
      ).length ?? 0,
  )
  const isBusy = computed(
    () => activity.value !== undefined || writeLocked.value || resolvingCount.value > 0,
  )
  const canChangeDirectory = computed(() => !isBusy.value)
  const canEditEntries = computed(() => activity.value === undefined && !writeLocked.value)
  const canRun = computed(
    () =>
      Boolean(preview.value) &&
      depth.value === preview.value?.depth &&
      readyCount.value > 0 &&
      !isBusy.value,
  )
  const defaultSource = () => settings.saved?.defaultSource ?? 'thb-wiki'

  const discardCurrentPreview = async () => {
    const batchId = preview.value?.batchId
    preview.value = undefined
    completion.value = undefined
    entries.clear()
    if (batchId) {
      try {
        await (await getApi()).discardBatch(batchId)
      } catch (error) {
        notifications.error(t('notifications.discardBatchFailed'), error)
      }
    }
  }
  const scan = async () => {
    if (!directory.value || isBusy.value) {
      return
    }
    activity.value = 'scanning'
    try {
      await discardCurrentPreview()

      const next = await (await getApi()).scanBatch(directory.value, depth.value, defaultSource())
      preview.value = next
      activity.value = undefined
      void entries.loadEntries(
        next.entries.filter(entry => entry.readiness === 'pending').map(entry => entry.id),
      )
    } catch (error) {
      notifications.error(t('notifications.scanBatchFailed'), error)
    } finally {
      activity.value = undefined
    }
  }
  const setDepth = async (value: number | null) => {
    if (value === null || value === depth.value || isBusy.value) {
      return
    }
    depth.value = value
    await scan()
  }
  const selectDirectory = async (target?: string) => {
    if (!canChangeDirectory.value) {
      return
    }
    activity.value = 'selecting'
    try {
      const selected =
        target ?? (await (await getApi()).selectBatchDirectory(t('batch.selectDirectoryDialog')))
      if (selected) {
        await discardCurrentPreview()

        directory.value = selected
      }
      activity.value = undefined
      if (selected) {
        await scan()
      }
    } catch (error) {
      activity.value = undefined
      notifications.error(t('notifications.selectBatchDirectoryFailed'), error)
    }
  }
  const complete = (result: BatchRunResult) => {
    if (preview.value) {
      preview.value = { ...preview.value, entries: result.entries }
    }
    completion.value = { kind: 'result', result }
  }
  const fail = (failure: WriteOperationFailure) => {
    completion.value = { kind: 'failure', failure }
  }
  const run = async (failedOnly = false) => {
    const current = preview.value
    if (!current || isBusy.value || (failedOnly ? !retryableCount.value : !canRun.value)) {
      return
    }
    completion.value = undefined
    await operations.run({
      kind: 'batch',
      execute: id => getApi().then(api => api.executeBatch(current.batchId, failedOnly, id)),
      cancel: id => getApi().then(api => api.cancelBatch(id)),
      initial: operationId => ({
        operationId,
        kind: 'batch',
        stage: 'preparing',
        current: 0,
        total: failedOnly ? retryableCount.value : readyCount.value,
        message: t('notifications.preparingBatchWrite'),
        cancellable: false,
      }),
      complete,
      failure: fail,
    })
  }
  const reveal = async () => {
    if (!directory.value) {
      return
    }
    try {
      await (await getApi()).revealDirectory(directory.value)
    } catch (error) {
      notifications.error(t('notifications.revealDirectoryFailed'), error)
    }
  }

  return {
    directory,
    depth,
    preview,
    selecting,
    scanning,
    operation,
    isWriting,
    completion,
    skippedCount,
    retryableCount,
    readyCount,
    resolvingCount,
    canRun,
    canChangeDirectory,
    canEditEntries,
    isBusy,
    setDepth,
    selectDirectory,
    scan,
    loadEntry: entries.loadEntry,
    resolveCandidate: entries.resolveCandidate,
    isResolving: entries.isResolving,
    run,
    cancel: operations.cancel,
    reveal,
    closeCompletion: () => (completion.value = undefined),
  }
})

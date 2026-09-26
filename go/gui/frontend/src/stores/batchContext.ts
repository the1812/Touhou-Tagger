import { computed, ref } from 'vue'

import { getApi, type BatchPreview, type BatchRunResult, type OperationFailure } from '../api'
import { t } from '../i18n'
import { useNotificationsStore } from './notifications'
import { useOperationsStore } from './operations'
import { useSettingsStore } from './settings'

export const createBatchContext = () => {
  const directory = ref('')
  const depth = ref(1)
  const source = ref('thb-wiki')
  const preview = ref<BatchPreview>()
  const selecting = ref(false)
  const scanning = ref(false)
  const result = ref<BatchRunResult>()
  const resolvingJobIds = ref(new Set<string>())
  const failure = ref<OperationFailure>()
  const resultOpen = ref(false)
  const notifications = useNotificationsStore()
  const operations = useOperationsStore()
  const settings = useSettingsStore()
  const contextVersion = { value: 0 }
  const resolveSequence = { value: 0 }
  const resolveTokens = new Map<string, number>()
  const starting = ref(false)
  const operation = computed(() => operations.get('batch'))
  const isWriting = computed(() => starting.value || Boolean(operation.value))
  const defaultSource = () => settings.saved?.defaultSource ?? 'thb-wiki'

  const readyCount = computed(() => preview.value?.jobs.filter(job => job.canRun).length ?? 0)
  const skippedCount = computed(() => (preview.value?.jobs.length ?? 0) - readyCount.value)
  const retryableCount = computed(
    () => preview.value?.jobs.filter(job => job.status === 'failed' && job.canRun).length ?? 0,
  )
  const resolvingCount = computed(() => resolvingJobIds.value.size)
  const canRun = computed(() =>
    Boolean(
      preview.value &&
      depth.value === preview.value.depth &&
      readyCount.value > 0 &&
      resolvingCount.value === 0 &&
      !selecting.value &&
      !scanning.value &&
      !isWriting.value,
    ),
  )

  const discardCurrentPreview = async () => {
    const batchId = preview.value?.batchId
    preview.value = undefined
    resultOpen.value = false
    failure.value = undefined
    result.value = undefined
    resolvingJobIds.value.clear()
    resolveTokens.clear()
    if (!batchId) {
      return
    }
    try {
      const api = await getApi()
      await api.discardBatch(batchId)
    } catch (error) {
      notifications.error(t('notifications.discardBatchFailed'), error)
    }
  }

  return {
    directory,
    depth,
    source,
    preview,
    selecting,
    scanning,
    result,
    resolvingJobIds,
    failure,
    resultOpen,
    notifications,
    operations,
    settings,
    contextVersion,
    resolveSequence,
    resolveTokens,
    starting,
    operation,
    isWriting,
    defaultSource,
    readyCount,
    skippedCount,
    retryableCount,
    resolvingCount,
    canRun,
    discardCurrentPreview,
  }
}

export type BatchContext = ReturnType<typeof createBatchContext>

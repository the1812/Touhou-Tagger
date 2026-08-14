import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  getApi,
  type AlbumCandidate,
  type AlbumMetadataPatch,
  type OperationFailure,
  type OperationProgress,
  type OperationResult,
  type PlanPreview,
  type TrackMetadataPatch,
  type WorkspaceSummary,
} from '../api'
import { useNotificationsStore } from './notifications'

export type WorkspacePhase =
  | 'idle'
  | 'selecting'
  | 'scanning'
  | 'scanned'
  | 'searching'
  | 'matched'
  | 'preparing'
  | 'ready'
  | 'editing'
  | 'writing'
  | 'committing'
  | 'renaming'
  | 'complete'
  | 'failed'
  | 'cancelled'

export const useWorkspaceStore = defineStore('workspace', () => {
  const phase = ref<WorkspacePhase>('idle')
  const directory = ref('')
  const summary = ref<WorkspaceSummary>()
  const query = ref('')
  const source = ref('thb-wiki')
  const defaultSource = ref('thb-wiki')
  const candidates = ref<AlbumCandidate[]>([])
  const hasSearched = ref(false)
  const selectedCandidateId = ref('')
  const plan = ref<PlanPreview>()
  const operation = ref<OperationProgress>()
  const result = ref<OperationResult>()
  const notifications = useNotificationsStore()
  let contextVersion = 0
  let activeOperationId = ''

  const isBusy = computed(() =>
    [
      'selecting',
      'scanning',
      'searching',
      'preparing',
      'editing',
      'writing',
      'committing',
      'renaming',
    ].includes(phase.value),
  )
  const blockingIssues = computed(() => {
    const issues = [
      ...(summary.value?.issues ?? []),
      ...(plan.value?.issues ?? []),
      ...(plan.value?.cover.issue ? [plan.value.cover.issue] : []),
      ...(plan.value?.items.flatMap(item => item.issues) ?? []),
    ]
    return issues.filter(issue => issue.severity === 'error')
  })
  const canSearch = computed(
    () =>
      Boolean(summary.value && summary.value.audioCount > 0 && query.value.trim()) &&
      phase.value !== 'failed' &&
      !isBusy.value,
  )
  const canPrepare = computed(
    () =>
      Boolean(summary.value && selectedCandidateId.value) &&
      phase.value !== 'failed' &&
      !isBusy.value,
  )
  const canCommit = computed(
    () =>
      phase.value === 'ready' &&
      Boolean(plan.value?.canCommit) &&
      blockingIssues.value.length === 0 &&
      !operation.value,
  )
  const clearAfterDirectory = () => {
    candidates.value = []
    hasSearched.value = false
    selectedCandidateId.value = ''
    plan.value = undefined
    operation.value = undefined
    result.value = undefined
  }

  const discardCurrentPlan = async () => {
    if (!plan.value) {
      return
    }
    const { planId } = plan.value
    plan.value = undefined
    try {
      const api = await getApi()
      await api.discardPlan(planId)
    } catch (error) {
      notifications.error('释放旧写入内容失败', error)
    }
  }

  const initializeSource = (value: string) => {
    defaultSource.value = value
    if (phase.value === 'idle' && !summary.value) {
      source.value = value
    }
  }

  async function preparePlan(sourceOverride?: string) {
    if (!canPrepare.value || !summary.value) {
      return
    }
    contextVersion += 1
    const requestVersion = contextVersion
    phase.value = 'preparing'
    try {
      const api = await getApi()
      const nextPlan = await api.preparePlan(
        summary.value.directory,
        selectedCandidateId.value,
        sourceOverride ?? source.value,
      )
      if (requestVersion !== contextVersion) {
        return
      }
      plan.value = nextPlan
      phase.value = 'ready'
    } catch (error) {
      if (requestVersion !== contextVersion) {
        return
      }
      phase.value = 'matched'
      notifications.error('准备写入内容失败', error)
    }
  }

  async function search() {
    if (!canSearch.value) {
      return
    }
    contextVersion += 1
    const requestVersion = contextVersion
    phase.value = 'searching'
    try {
      const api = await getApi()
      const nextCandidates = await api.searchAlbums(
        directory.value,
        query.value.trim(),
        source.value,
      )
      if (requestVersion !== contextVersion) {
        return
      }
      candidates.value = nextCandidates
      hasSearched.value = true
      const exact =
        candidates.value.length === 1
          ? candidates.value[0]
          : candidates.value.find(candidate => candidate.exactMatch)
      selectedCandidateId.value = exact?.id ?? ''
      plan.value = undefined
      phase.value = selectedCandidateId.value ? 'matched' : 'scanned'
      if (candidates.value.length === 1) {
        await preparePlan()
      }
    } catch (error) {
      if (requestVersion !== contextVersion) {
        return
      }
      phase.value = candidates.value.length ? 'matched' : 'scanned'
      notifications.error('搜索专辑失败', error)
    }
  }

  const scan = async (targetDirectory = directory.value) => {
    if (!targetDirectory || isBusy.value || operation.value) {
      return
    }
    contextVersion += 1
    const requestVersion = contextVersion
    phase.value = 'scanning'
    try {
      const startsNewWorkspace = targetDirectory !== directory.value
      await discardCurrentPlan()
      const api = await getApi()
      const nextSummary = await api.scanWorkspace(targetDirectory)
      if (requestVersion !== contextVersion) {
        return
      }
      if (startsNewWorkspace) {
        source.value = nextSummary.effectiveSource || defaultSource.value
      }
      directory.value = nextSummary.directory
      summary.value = nextSummary
      query.value = nextSummary.inferredAlbumName
      clearAfterDirectory()
      phase.value = 'scanned'
      if (!nextSummary.hasMetadataJson) {
        await search()
      }
    } catch (error) {
      if (requestVersion !== contextVersion) {
        return
      }
      phase.value = summary.value ? 'scanned' : 'idle'
      notifications.error('扫描专辑失败', error)
    }
  }

  const selectDirectory = async () => {
    if (isBusy.value || operation.value) {
      return
    }
    const previousPhase = phase.value
    phase.value = 'selecting'
    try {
      const api = await getApi()
      const selected = await api.selectAlbumDirectory()
      if (!selected) {
        phase.value = previousPhase
        return
      }
      phase.value = previousPhase
      await scan(selected)
    } catch (error) {
      phase.value = previousPhase
      notifications.error('无法选择专辑文件夹', error)
    }
  }

  const selectCandidate = (candidateId: string) => {
    if (isBusy.value) {
      return
    }
    selectedCandidateId.value = candidateId
    plan.value = undefined
    phase.value = 'matched'
  }

  const changeSource = (nextSource: string) => {
    if (source.value === nextSource || isBusy.value) {
      return
    }
    contextVersion += 1
    source.value = nextSource
    candidates.value = []
    selectedCandidateId.value = ''
    hasSearched.value = false
    plan.value = undefined
    phase.value = summary.value ? 'scanned' : 'idle'
  }

  const backToSearch = async () => {
    if (!plan.value || isBusy.value || operation.value) {
      return
    }
    contextVersion += 1
    await discardCurrentPlan()
    phase.value = selectedCandidateId.value ? 'matched' : 'scanned'
  }

  const updateAlbum = async (album: AlbumMetadataPatch) => {
    if (!plan.value || isBusy.value) {
      return
    }
    contextVersion += 1
    const requestVersion = contextVersion
    phase.value = 'editing'
    try {
      const api = await getApi()
      const nextPlan = await api.updatePlan({
        planId: plan.value.planId,
        revision: plan.value.revision,
        album,
      })
      if (requestVersion !== contextVersion) {
        return
      }
      plan.value = nextPlan
      phase.value = 'ready'
    } catch (error) {
      if (requestVersion !== contextVersion) {
        return
      }
      phase.value = 'ready'
      notifications.error('更新专辑信息失败', error)
    }
  }

  const updateTrack = async (track: TrackMetadataPatch) => {
    if (!plan.value || isBusy.value) {
      return
    }
    contextVersion += 1
    const requestVersion = contextVersion
    phase.value = 'editing'
    try {
      const api = await getApi()
      const nextPlan = await api.updatePlan({
        planId: plan.value.planId,
        revision: plan.value.revision,
        tracks: [track],
      })
      if (requestVersion !== contextVersion) {
        return
      }
      plan.value = nextPlan
      phase.value = 'ready'
    } catch (error) {
      if (requestVersion !== contextVersion) {
        return
      }
      phase.value = 'ready'
      notifications.error('更新曲目信息失败', error)
    }
  }

  const updateSaveCover = async (saveCover: boolean) => {
    if (!plan.value || isBusy.value || !plan.value.options.canSaveCover) {
      return
    }
    contextVersion += 1
    const requestVersion = contextVersion
    phase.value = 'editing'
    try {
      const api = await getApi()
      const nextPlan = await api.updatePlan({
        planId: plan.value.planId,
        revision: plan.value.revision,
        saveCover,
      })
      if (requestVersion !== contextVersion) {
        return
      }
      plan.value = nextPlan
      phase.value = 'ready'
    } catch (error) {
      if (requestVersion !== contextVersion) {
        return
      }
      phase.value = 'ready'
      notifications.error('更新封面保存选项失败', error)
    }
  }

  const commit = async () => {
    if (!canCommit.value || !plan.value) {
      return
    }
    const currentPlan = plan.value
    let reservedOperationId = ''
    phase.value = 'writing'
    result.value = undefined
    try {
      const api = await getApi()
      const started = await api.commitPlan(currentPlan.planId, currentPlan.revision)
      reservedOperationId = started.operationId
      activeOperationId = started.operationId
      operation.value = {
        operationId: started.operationId,
        kind: 'workspace',
        stage: 'preparing',
        current: 0,
        total: currentPlan.items.length,
        message: '正在准备写入',
        cancellable: true,
      }
      await api.startOperation(started.operationId)
    } catch (error) {
      activeOperationId = ''
      operation.value = undefined
      phase.value = 'ready'
      let cleanupDetails = ''
      if (reservedOperationId) {
        try {
          const api = await getApi()
          await api.cancelOperation(reservedOperationId)
        } catch (cleanupError) {
          cleanupDetails =
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        }
      }
      notifications.error('无法开始写入', error, {
        sticky: true,
        diagnostics: cleanupDetails || undefined,
      })
    }
  }

  const cancel = async () => {
    if (!operation.value?.cancellable) {
      return
    }
    try {
      const api = await getApi()
      await api.cancelOperation(operation.value.operationId)
    } catch (error) {
      notifications.error('取消写入失败', error)
    }
  }

  const reveal = async () => {
    if (!directory.value) {
      return
    }
    try {
      const api = await getApi()
      await api.revealDirectory(directory.value)
    } catch (error) {
      notifications.error('无法在资源管理器中打开目录', error)
    }
  }

  const startOver = async () => {
    contextVersion += 1
    await discardCurrentPlan()
    phase.value = 'idle'
    directory.value = ''
    summary.value = undefined
    query.value = ''
    source.value = defaultSource.value
    clearAfterDirectory()
  }

  const receiveProgress = (progress: OperationProgress) => {
    if (progress.kind !== 'workspace' || progress.operationId !== activeOperationId) {
      return
    }
    operation.value = progress
    phase.value =
      progress.stage === 'committing'
        ? 'committing'
        : progress.stage === 'renaming'
          ? 'renaming'
          : progress.stage === 'cancelled'
            ? 'cancelled'
            : 'writing'
  }

  const receiveComplete = (nextResult: OperationResult) => {
    if (nextResult.kind !== 'workspace' || nextResult.operationId !== activeOperationId) {
      return
    }
    activeOperationId = ''
    operation.value = undefined
    if (nextResult.cancelled) {
      result.value = undefined
      phase.value = plan.value ? 'ready' : 'failed'
      notifications.info('写入已取消', nextResult.message)
      return
    }
    result.value = nextResult
    plan.value = undefined
    phase.value = 'complete'
  }

  const receiveFailure = (failure: OperationFailure) => {
    if (failure.kind !== 'workspace' || failure.operationId !== activeOperationId) {
      return
    }
    activeOperationId = ''
    operation.value = undefined
    if (failure.planInvalidated) {
      plan.value = undefined
      phase.value = 'failed'
    } else {
      phase.value = plan.value ? 'ready' : 'failed'
    }
    notifications.error('写入过程失败', failure.message, {
      sticky: true,
      diagnostics: failure.details,
    })
  }

  return {
    phase,
    directory,
    summary,
    query,
    source,
    candidates,
    hasSearched,
    selectedCandidateId,
    plan,
    operation,
    result,
    isBusy,
    blockingIssues,
    canSearch,
    canPrepare,
    canCommit,
    selectDirectory,
    initializeSource,
    scan,
    search,
    selectCandidate,
    changeSource,
    preparePlan,
    backToSearch,
    updateAlbum,
    updateTrack,
    updateSaveCover,
    commit,
    cancel,
    reveal,
    startOver,
    receiveProgress,
    receiveComplete,
    receiveFailure,
  }
})

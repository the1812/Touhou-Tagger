import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  getApi,
  type AlbumCandidate,
  type AlbumMetadataPatch,
  type BatchRunResult,
  type OperationFailure,
  type OperationResult,
  type PlanPreview,
  type TrackMetadataPatch,
  type WorkspaceSummary,
} from '../api'
import { t } from '../i18n'
import { useNotificationsStore } from './notifications'
import { useOperationsStore } from './operations'
import { useSettingsStore } from './settings'

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
  | 'complete'
  | 'failed'

export const useWorkspaceStore = defineStore('workspace', () => {
  const phase = ref<WorkspacePhase>('idle')
  const directory = ref('')
  const summary = ref<WorkspaceSummary>()
  const query = ref('')
  const source = ref('thb-wiki')
  const candidates = ref<AlbumCandidate[]>([])
  const hasSearched = ref(false)
  const selectedCandidateId = ref('')
  const plan = ref<PlanPreview>()
  const result = ref<OperationResult>()
  const notifications = useNotificationsStore()
  const operations = useOperationsStore()
  const settings = useSettingsStore()
  let contextVersion = 0

  const operation = computed(() => operations.get('workspace'))
  const defaultSource = () => settings.saved?.defaultSource ?? 'thb-wiki'

  const isBusy = computed(
    () =>
      ['selecting', 'scanning', 'searching', 'preparing', 'editing'].includes(phase.value) ||
      Boolean(operation.value),
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
      notifications.error(t('notifications.discardPlanFailed'), error)
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
      notifications.error(t('notifications.preparePlanFailed'), error)
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
      notifications.error(t('notifications.searchAlbumsFailed'), error)
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
        source.value = nextSummary.effectiveSource || defaultSource()
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
      notifications.error(t('notifications.scanAlbumFailed'), error)
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
      const selected = await api.selectAlbumDirectory(t('tagging.selectDirectoryDialog'))
      if (!selected) {
        phase.value = previousPhase
        return
      }
      phase.value = previousPhase
      await scan(selected)
    } catch (error) {
      phase.value = previousPhase
      notifications.error(t('notifications.selectAlbumDirectoryFailed'), error)
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
      notifications.error(t('notifications.updateAlbumFailed'), error)
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
      notifications.error(t('notifications.updateTrackFailed'), error)
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
      notifications.error(t('notifications.updateCoverOptionFailed'), error)
    }
  }

  function receiveComplete(completion: OperationResult | BatchRunResult) {
    if (completion.kind !== 'workspace') {
      return
    }
    const nextResult = completion as OperationResult
    if (nextResult.cancelled) {
      result.value = undefined
      phase.value = plan.value ? 'ready' : 'failed'
      notifications.info(t('notifications.writeCancelled'), nextResult.message)
      return
    }
    result.value = nextResult
    plan.value = undefined
    phase.value = 'complete'
  }

  function receiveFailure(failure: OperationFailure) {
    if (failure.kind !== 'workspace') {
      return
    }
    if (failure.planInvalidated) {
      plan.value = undefined
      phase.value = 'failed'
    } else {
      phase.value = plan.value ? 'ready' : 'failed'
    }
    notifications.error(t('notifications.writeFailed'), failure.message, {
      sticky: true,
      diagnostics: failure.details,
    })
  }

  const commit = async () => {
    if (!canCommit.value || !plan.value) {
      return
    }
    const currentPlan = plan.value
    let reservedOperationId = ''
    result.value = undefined
    try {
      const api = await getApi()
      const started = await api.commitPlan(currentPlan.planId, currentPlan.revision)
      reservedOperationId = started.operationId
      operations.begin(
        {
          operationId: started.operationId,
          kind: 'workspace',
          stage: 'preparing',
          current: 0,
          total: currentPlan.items.length,
          message: t('notifications.preparingWrite'),
          cancellable: true,
        },
        {
          complete: receiveComplete,
          failure: receiveFailure,
        },
      )
      await api.startOperation(started.operationId)
    } catch (error) {
      operations.release(reservedOperationId)
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
      notifications.error(t('notifications.startWriteFailed'), error, {
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
      notifications.error(t('notifications.cancelWriteFailed'), error)
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
      notifications.error(t('notifications.revealDirectoryFailed'), error)
    }
  }

  const startOver = async () => {
    contextVersion += 1
    await discardCurrentPlan()
    phase.value = 'idle'
    directory.value = ''
    summary.value = undefined
    query.value = ''
    source.value = defaultSource()
    clearAfterDirectory()
  }

  const loadStartupDirectory = async () => {
    if (phase.value !== 'idle') {
      return
    }
    try {
      const api = await getApi()
      const startupDirectory = await api.getStartupDirectory()
      if (startupDirectory) {
        await scan(startupDirectory)
      }
    } catch (error) {
      notifications.error(t('notifications.loadStartupDirectoryFailed'), error)
    }
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
    loadStartupDirectory,
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
  }
})

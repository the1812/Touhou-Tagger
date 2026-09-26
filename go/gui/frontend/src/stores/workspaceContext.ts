import { computed, ref } from 'vue'

import {
  getApi,
  type AlbumCandidate,
  type OperationFailure,
  type OperationResult,
  type PlanPreview,
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
  | 'failed'

export const createWorkspaceContext = () => {
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
  const failure = ref<OperationFailure>()
  const resultOpen = ref(false)
  const notifications = useNotificationsStore()
  const operations = useOperationsStore()
  const settings = useSettingsStore()
  const contextVersion = { value: 0 }

  const starting = ref(false)
  const operation = computed(() => operations.get('workspace'))
  const isWriting = computed(() => starting.value || Boolean(operation.value))
  const defaultSource = () => settings.saved?.defaultSource ?? 'thb-wiki'

  const isBusy = computed(
    () =>
      ['selecting', 'scanning', 'searching', 'preparing', 'editing'].includes(phase.value) ||
      isWriting.value,
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
      !isWriting.value,
  )
  const clearAfterDirectory = () => {
    candidates.value = []
    hasSearched.value = false
    selectedCandidateId.value = ''
    plan.value = undefined
    result.value = undefined
    failure.value = undefined
    resultOpen.value = false
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
    result,
    failure,
    resultOpen,
    notifications,
    operations,
    settings,
    contextVersion,
    starting,
    operation,
    isWriting,
    defaultSource,
    isBusy,
    blockingIssues,
    canSearch,
    canPrepare,
    canCommit,
    clearAfterDirectory,
    discardCurrentPlan,
  }
}

export type WorkspaceContext = ReturnType<typeof createWorkspaceContext>

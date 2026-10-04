import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  useNotificationsStore,
  useWriteOperationsStore,
  useSettingsStore,
} from '../../../entities/session'
import { getApi, type PlanPreview, type WorkspaceSummary } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { useWorkspacePlan } from './plan'
import { useWorkspaceSearch, type WorkspaceActivity } from './search'
import { useWorkspaceWriting } from './writing'

export const useWorkspaceStore = defineStore('workspace', () => {
  const directory = ref('')
  const summary = ref<WorkspaceSummary>()
  const plan = ref<PlanPreview>()
  const stalePlan = ref(false)
  const activity = ref<WorkspaceActivity>()
  const notifications = useNotificationsStore()
  const operations = useWriteOperationsStore()
  const settings = useSettingsStore()

  const isWriting = computed(() => operations.activeKind === 'workspace')
  const isBusy = computed(() => activity.value !== undefined || operations.isWriting)
  const canChangeDirectory = computed(() => !isBusy.value)
  const defaultSource = () => settings.saved?.source ?? 'thb-wiki'
  const discardPlan = async () => {
    const current = plan.value
    plan.value = undefined
    stalePlan.value = false
    if (current) {
      try {
        await (await getApi()).discardPlan(current.planId)
      } catch (error) {
        notifications.error(t('notifications.discardPlanFailed'), error)
      }
    }
  }
  async function prepareFor(candidateId: string, sourceOverride: string, opening: boolean) {
    activity.value = opening ? 'opening' : 'preparing'
    try {
      const next = await (await getApi()).preparePlan(directory.value, candidateId, sourceOverride)
      plan.value = next
      stalePlan.value = false
    } catch (error) {
      notifications.error(t('notifications.preparePlanFailed'), error)
    }
  }
  const searchSession = useWorkspaceSearch({
    directory,
    summary,
    plan,
    activity,
    isBusy,
    prepareFor,
  })
  const { query, source, candidates, selectedCandidateId, clearSearch } = searchSession
  const canPrepare = computed(
    () => Boolean(summary.value && selectedCandidateId.value) && !isBusy.value && !stalePlan.value,
  )
  const planEditor = useWorkspacePlan({
    plan,
    stalePlan,
    summary,
    activity,
    isBusy,
  })
  const canExecute = computed(() => planEditor.canExecute.value && !operations.isActive)
  const writer = useWorkspaceWriting({
    plan,
    stalePlan,
    directory,
    canExecute,
  })

  const preparePlan = async (sourceOverride = source.value) => {
    if (!canPrepare.value) {
      return
    }
    try {
      await prepareFor(selectedCandidateId.value, sourceOverride, false)
    } finally {
      activity.value = undefined
    }
  }
  const scan = async (targetDirectory: string) => {
    if (!targetDirectory || !canChangeDirectory.value) {
      return
    }
    activity.value = 'opening'
    try {
      await discardPlan()
      directory.value = targetDirectory
      summary.value = undefined
      query.value = ''
      source.value = defaultSource()
      clearSearch()
      const next = await (await getApi()).scanWorkspace(targetDirectory)
      directory.value = next.directory
      summary.value = next
      source.value =
        next.effectiveSource === 'local-json'
          ? defaultSource()
          : next.effectiveSource || defaultSource()
      query.value = next.inferredAlbumName
      if (next.audioCount === 0) {
        return
      }
      if (next.hasMetadataJson) {
        selectedCandidateId.value = 'local-json'
        await prepareFor('local-json', 'local-json', true)
      } else {
        await searchSession.searchFor(true)
      }
    } catch (error) {
      notifications.error(t('notifications.scanAlbumFailed'), error)
    } finally {
      activity.value = undefined
    }
  }
  const selectDirectory = async (target?: string) => {
    if (!canChangeDirectory.value) {
      return
    }
    activity.value = 'selecting'
    try {
      const selected =
        target ?? (await (await getApi()).selectAlbumDirectory(t('tagging.selectDirectoryDialog')))
      activity.value = undefined
      if (selected) {
        await scan(selected)
      }
    } catch (error) {
      activity.value = undefined
      notifications.error(t('notifications.selectAlbumDirectoryFailed'), error)
    }
  }
  const backToSearch = async () => {
    if (!plan.value || isBusy.value) {
      return
    }
    activity.value = 'editing'
    try {
      await discardPlan()
    } finally {
      activity.value = undefined
    }
  }

  return {
    directory,
    summary,
    query,
    source,
    candidates,
    selectedCandidateId,
    plan,
    stalePlan,
    activity,
    isBusy,
    isWriting,
    canSearch: searchSession.canSearch,
    canPrepare,
    canChangeDirectory,
    blockingIssues: planEditor.blockingIssues,
    canExecute,
    search: searchSession.search,
    preparePlan,
    scan,
    selectDirectory,
    selectCandidate: searchSession.selectCandidate,
    changeSource: searchSession.changeSource,
    backToSearch,
    updateAlbum: planEditor.updateAlbum,
    updateTrack: planEditor.updateTrack,
    updateSaveCover: planEditor.setSaveCover,
    ...writer,
  }
})

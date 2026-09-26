import { getApi } from '../api'
import { t } from '../i18n'
import type { WorkspaceContext } from './workspaceContext'

export const createWorkspaceDiscovery = (context: WorkspaceContext) => {
  const {
    phase,
    directory,
    summary,
    query,
    source,
    candidates,
    hasSearched,
    selectedCandidateId,
    plan,
    notifications,
    operation,
    isBusy,
    canSearch,
    canPrepare,
    contextVersion,
    defaultSource,
    clearAfterDirectory,
    discardCurrentPlan,
  } = context
  async function preparePlan(sourceOverride?: string) {
    if (!canPrepare.value || !summary.value) {
      return
    }
    contextVersion.value += 1
    const requestVersion = contextVersion.value
    phase.value = 'preparing'
    try {
      const api = await getApi()
      const nextPlan = await api.preparePlan(
        summary.value.directory,
        selectedCandidateId.value,
        sourceOverride ?? source.value,
      )
      if (requestVersion !== contextVersion.value) {
        return
      }
      plan.value = nextPlan
      phase.value = 'ready'
    } catch (error) {
      if (requestVersion !== contextVersion.value) {
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
    contextVersion.value += 1
    const requestVersion = contextVersion.value
    phase.value = 'searching'
    try {
      const api = await getApi()
      const nextCandidates = await api.searchAlbums(
        directory.value,
        query.value.trim(),
        source.value,
      )
      if (requestVersion !== contextVersion.value) {
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
      if (requestVersion !== contextVersion.value) {
        return
      }
      phase.value = candidates.value.length ? 'matched' : 'scanned'
      notifications.error(t('notifications.searchAlbumsFailed'), error)
    }
  }

  const scan = async (targetDirectory: string) => {
    if (!targetDirectory || isBusy.value || operation.value) {
      return
    }
    contextVersion.value += 1
    const requestVersion = contextVersion.value
    phase.value = 'scanning'
    try {
      await discardCurrentPlan()
      directory.value = targetDirectory
      summary.value = undefined
      query.value = ''
      source.value = defaultSource()
      clearAfterDirectory()
      const api = await getApi()
      const nextSummary = await api.scanWorkspace(targetDirectory)
      if (requestVersion !== contextVersion.value) {
        return
      }
      source.value =
        nextSummary.effectiveSource === 'local-json'
          ? defaultSource()
          : nextSummary.effectiveSource || defaultSource()
      directory.value = nextSummary.directory
      summary.value = nextSummary
      query.value = nextSummary.inferredAlbumName
      phase.value = 'scanned'
      if (nextSummary.hasMetadataJson) {
        selectedCandidateId.value = 'local-json'
        phase.value = 'matched'
        await preparePlan('local-json')
        return
      }
      await search()
    } catch (error) {
      if (requestVersion !== contextVersion.value) {
        return
      }
      phase.value = 'idle'
      notifications.error(t('notifications.scanAlbumFailed'), error)
    }
  }

  const selectDirectory = async (targetDirectory?: string) => {
    if (isBusy.value || operation.value) {
      return
    }
    const previousPhase = phase.value
    phase.value = 'selecting'
    try {
      const api = await getApi()
      const selected =
        targetDirectory ?? (await api.selectAlbumDirectory(t('tagging.selectDirectoryDialog')))
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

  return { preparePlan, search, scan, selectDirectory }
}

import { getApi } from '../api'
import { t } from '../i18n'
import type { WorkspaceContext } from './workspaceContext'
import type { createWorkspaceDiscovery } from './workspaceDiscovery'

export const createWorkspaceSelection = (
  context: WorkspaceContext,
  discovery: ReturnType<typeof createWorkspaceDiscovery>,
) => {
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
    contextVersion,
    defaultSource,
    clearAfterDirectory,
    discardCurrentPlan,
  } = context
  const { scan } = discovery
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
    contextVersion.value += 1
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
    contextVersion.value += 1
    await discardCurrentPlan()
    phase.value = selectedCandidateId.value ? 'matched' : 'scanned'
  }
  const startOver = async () => {
    contextVersion.value += 1
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

  return { selectCandidate, changeSource, backToSearch, startOver, loadStartupDirectory }
}

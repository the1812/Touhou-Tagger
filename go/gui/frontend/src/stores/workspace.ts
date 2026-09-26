import { defineStore } from 'pinia'

import { createWorkspaceContext } from './workspaceContext'
import { createWorkspaceDiscovery } from './workspaceDiscovery'
import { createWorkspaceEditing } from './workspaceEditing'
import { createWorkspaceSelection } from './workspaceSelection'
import { createWorkspaceWriting } from './workspaceWriting'

export const useWorkspaceStore = defineStore('workspace', () => {
  const context = createWorkspaceContext()
  const discovery = createWorkspaceDiscovery(context)
  const selection = createWorkspaceSelection(context, discovery)
  const editing = createWorkspaceEditing(context)
  const writing = createWorkspaceWriting(context)
  return {
    phase: context.phase,
    directory: context.directory,
    summary: context.summary,
    query: context.query,
    source: context.source,
    candidates: context.candidates,
    hasSearched: context.hasSearched,
    selectedCandidateId: context.selectedCandidateId,
    plan: context.plan,
    operation: context.operation,
    result: context.result,
    failure: context.failure,
    resultOpen: context.resultOpen,
    isBusy: context.isBusy,
    isWriting: context.isWriting,
    blockingIssues: context.blockingIssues,
    canSearch: context.canSearch,
    canPrepare: context.canPrepare,
    canCommit: context.canCommit,
    ...discovery,
    ...selection,
    ...editing,
    ...writing,
  }
})

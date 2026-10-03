import { t } from '../i18n'
import { errorMessage } from './errorMessage'
import type {
  BatchEntryPreview,
  WriteOperationFailure,
  WriteOperationProgress,
  WriteOperationResult,
  StateIssue,
} from './types'

const issueKeys: Record<string, string> = {
  'no-audio': 'backend.issue.noAudio',
  'invalid-cover': 'backend.issue.invalidCover',
  'cover-target-invalid': 'backend.issue.invalidCover',
  'scan-failed': 'backend.issue.scanFailed',
  'load-failed': 'batch.loadFailed',
  'config-failed': 'backend.issue.configFailed',
  'search-failed': 'backend.issue.searchFailed',
  'candidate-required': 'backend.issue.candidateRequired',
  'prepare-failed': 'backend.issue.prepareFailed',
  'operation-failed': 'backend.issue.operationFailed',
  'title-required': 'backend.issue.titleRequired',
  'missing-artists': 'backend.issue.missingArtists',
  'track-mismatch': 'backend.issue.trackMismatch',
  'target-exists': 'backend.issue.targetExists',
  'target-conflict': 'backend.issue.targetConflict',
}

export const issueText = (issue: StateIssue) =>
  issue.error
    ? errorMessage(issue.error)
    : issue.message || t(issueKeys[issue.code] ?? 'backend.issue.generic')

export const progressText = (progress: WriteOperationProgress) => {
  const keys: Record<string, string> = {
    search: 'backend.progress.searching',
    fetch: 'backend.progress.fetching',
    plan: 'backend.progress.preparing',
    write: 'backend.progress.writing',
    rename: 'backend.progress.renaming',
    complete: 'backend.progress.complete',
  }
  const messageKey = progress.messageId && keys[progress.messageId]
  if (messageKey) {
    return t(messageKey, { current: progress.current, total: progress.total })
  }
  if (progress.kind === 'batch' && progress.stage === 'preparing') {
    return t('backend.progress.batchAlbum', {
      current: progress.current,
      total: progress.total,
    })
  }
  const stageKeys: Partial<Record<WriteOperationProgress['stage'], string>> = {
    preparing: 'backend.progress.preparing',
    writing: 'backend.progress.writing',
    renaming: 'backend.progress.renaming',
    complete: 'backend.progress.complete',
  }
  const stageKey = stageKeys[progress.stage]
  return stageKey
    ? t(stageKey, { current: progress.current, total: progress.total })
    : progress.message
}

export const resultTitle = (result: WriteOperationResult) => {
  if (result.cancelled) {
    return t(result.kind === 'batch' ? 'backend.result.batchCancelled' : 'backend.result.cancelled')
  }
  return result.kind === 'batch'
    ? t('backend.result.batchComplete', { succeeded: result.succeeded, failed: result.failed })
    : t('backend.result.writeComplete', { count: result.succeeded })
}

export const failureTitle = (failure: WriteOperationFailure) =>
  failure.error ? errorMessage(failure.error) : failure.message

export const batchStatusInfo = (entry: BatchEntryPreview, loading: boolean) => {
  if (loading || entry.readiness === 'pending') {
    return { label: t('batch.status.loading'), severity: 'info' as const }
  }
  if (entry.outcome === 'succeeded') {
    return { label: t('batch.status.succeeded'), severity: 'success' as const }
  }
  if (entry.outcome === 'failed') {
    return { label: t('batch.status.failed'), severity: 'danger' as const }
  }
  if (entry.outcome === 'cancelled') {
    return { label: t('batch.status.cancelled'), severity: 'secondary' as const }
  }
  if (entry.readiness === 'skipped') {
    return { label: t('batch.noAudio'), severity: 'secondary' as const }
  }
  if (entry.readiness === 'needs-candidate') {
    return { label: t('batch.status.needsCandidate'), severity: 'warn' as const }
  }
  if (entry.readiness === 'blocked') {
    const scanIssue = entry.issues.some(
      issue => issue.code === 'scan-failed' || issue.code === 'load-failed',
    )
    return scanIssue
      ? { label: t('batch.loadFailed'), severity: 'danger' as const }
      : { label: t('batch.status.blocked'), severity: 'danger' as const }
  }
  return { label: t('batch.status.ready'), severity: 'success' as const }
}

export const batchMatchText = (entry: BatchEntryPreview, loading: boolean) => {
  if (loading || entry.readiness === 'pending') {
    return t('batch.loadingAlbum')
  }
  if (entry.readiness === 'skipped') {
    return t('batch.noAudio')
  }
  if (entry.readiness === 'blocked') {
    return entry.issues.some(issue => issue.code === 'scan-failed' || issue.code === 'load-failed')
      ? t('batch.loadFailed')
      : t('batch.status.blocked')
  }
  if (entry.readiness === 'needs-candidate') {
    return entry.candidates.length
      ? t('batch.resultCount', { count: entry.candidates.length })
      : t('batch.noSearchResults')
  }
  const selected = entry.candidates.find(candidate => candidate.id === entry.selectedCandidateId)
  return selected?.exactMatch === false ? t('batch.selectedCandidate') : t('batch.exactMatch')
}

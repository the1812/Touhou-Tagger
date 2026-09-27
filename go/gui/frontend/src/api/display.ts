import { t } from '../i18n'
import { errorMessage } from './errorMessage'
import type {
  BatchJobPreview,
  OperationFailure,
  OperationProgress,
  OperationResult,
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

export const progressText = (progress: OperationProgress) => {
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
  const stageKeys: Partial<Record<OperationProgress['stage'], string>> = {
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

export const resultTitle = (result: OperationResult) => {
  if (result.cancelled) {
    return t(result.kind === 'batch' ? 'backend.result.batchCancelled' : 'backend.result.cancelled')
  }
  return result.kind === 'batch'
    ? t('backend.result.batchComplete', { succeeded: result.succeeded, failed: result.failed })
    : t('backend.result.writeComplete', { count: result.succeeded })
}

export const failureTitle = (failure: OperationFailure) =>
  failure.error ? errorMessage(failure.error) : failure.message

export const batchStatusInfo = (job: BatchJobPreview, loading: boolean) => {
  if (loading || job.readiness === 'pending') {
    return { label: t('batch.status.loading'), severity: 'info' as const }
  }
  if (job.outcome === 'succeeded') {
    return { label: t('batch.status.succeeded'), severity: 'success' as const }
  }
  if (job.outcome === 'failed') {
    return { label: t('batch.status.failed'), severity: 'danger' as const }
  }
  if (job.outcome === 'cancelled') {
    return { label: t('batch.status.cancelled'), severity: 'secondary' as const }
  }
  if (job.readiness === 'skipped') {
    return { label: t('batch.noAudio'), severity: 'secondary' as const }
  }
  if (job.readiness === 'needs-candidate') {
    return { label: t('batch.status.needsCandidate'), severity: 'warn' as const }
  }
  if (job.readiness === 'blocked') {
    const scanIssue = job.issues.some(
      issue => issue.code === 'scan-failed' || issue.code === 'load-failed',
    )
    return scanIssue
      ? { label: t('batch.loadFailed'), severity: 'danger' as const }
      : { label: t('batch.status.blocked'), severity: 'danger' as const }
  }
  return { label: t('batch.status.ready'), severity: 'success' as const }
}

export const batchMatchText = (job: BatchJobPreview, loading: boolean) => {
  if (loading || job.readiness === 'pending') {
    return t('batch.loadingAlbum')
  }
  if (job.readiness === 'skipped') {
    return t('batch.noAudio')
  }
  if (job.readiness === 'blocked') {
    return job.issues.some(issue => issue.code === 'scan-failed' || issue.code === 'load-failed')
      ? t('batch.loadFailed')
      : t('batch.status.blocked')
  }
  if (job.readiness === 'needs-candidate') {
    return job.candidates.length
      ? t('batch.resultCount', { count: job.candidates.length })
      : t('batch.noSearchResults')
  }
  const selected = job.candidates.find(candidate => candidate.id === job.selectedCandidateId)
  return selected?.exactMatch === false ? t('batch.selectedCandidate') : t('batch.exactMatch')
}

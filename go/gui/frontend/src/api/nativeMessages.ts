import { t } from '../i18n'
import { errorMessage } from './errorMessage'
import type { Wire } from './nativeNormalization'
import type { BatchRunResult, ErrorInfo, OperationProgress, OperationResult } from './types'

const issueMessage = (code: string) => {
  const keys: Record<string, string> = {
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
  return t(keys[code] ?? 'backend.issue.generic')
}

export const normalizeIssue = <T extends { code: string; message: string; error?: ErrorInfo }>(
  issue: T,
): T => ({
  ...issue,
  message: issue.error ? errorMessage(issue.error) : issue.message || issueMessage(issue.code),
})

export const optionLabel = (value: string, fallback: string) => {
  const keys: Record<string, string> = {
    zho: 'data.chinese',
    'zh-Hans': 'data.simplifiedChinese',
    jpn: 'data.japanese',
    ja: 'data.japanese',
    original: 'data.original',
    translated: 'data.translated',
    mixed: 'data.mixed',
  }
  return keys[value] ? t(keys[value]) : fallback
}

const progressMessage = (progress: OperationProgress) => {
  const messageKeys: Record<string, string> = {
    search: 'backend.progress.searching',
    fetch: 'backend.progress.fetching',
    plan: 'backend.progress.preparing',
    write: 'backend.progress.writing',
    rename: 'backend.progress.renaming',
    complete: 'backend.progress.complete',
  }
  if (progress.messageId && messageKeys[progress.messageId]) {
    return t(messageKeys[progress.messageId], {
      current: progress.current,
      total: progress.total,
    })
  }
  if (progress.kind === 'batch' && progress.stage === 'preparing') {
    return t('backend.progress.batchAlbum', {
      current: progress.current,
      total: progress.total,
    })
  }
  const keys: Partial<Record<OperationProgress['stage'], string>> = {
    preparing: 'backend.progress.preparing',
    writing: 'backend.progress.writing',
    renaming: 'backend.progress.renaming',
    complete: 'backend.progress.complete',
  }
  const key = keys[progress.stage]
  return key ? t(key, { current: progress.current, total: progress.total }) : progress.message
}

export const normalizeProgress = (progress: OperationProgress): OperationProgress => ({
  ...progress,
  message: progressMessage(progress),
})

export const normalizeResult = <T extends Wire<OperationResult | BatchRunResult>>(result: T): T => {
  let message: string
  if (result.cancelled) {
    message = t(
      result.kind === 'batch' ? 'backend.result.batchCancelled' : 'backend.result.cancelled',
    )
  } else if (result.kind === 'batch') {
    message = t('backend.result.batchComplete', {
      succeeded: result.succeeded,
      failed: result.failed,
    })
  } else {
    message = t('backend.result.writeComplete', { count: result.succeeded })
  }
  return { ...result, message }
}

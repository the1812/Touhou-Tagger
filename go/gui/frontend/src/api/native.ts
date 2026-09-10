import { Events } from '@wailsio/runtime'

import {
  BatchService,
  SettingsService,
  WorkspaceService,
} from '../../bindings/github.com/the1812/Touhou-Tagger/go/gui/internal/bridge/index.js'
import { t } from '../i18n'
import { errorMessage } from './errorMessage'
import type {
  AlbumCandidate,
  BatchJobPreview,
  BatchPreview,
  BatchRunResult,
  GUIApi,
  OperationFailure,
  OperationProgress,
  OperationResult,
  PlanPatch,
  PlanPreview,
  ProcessError,
  ErrorInfo,
  WorkspaceSummary,
} from './types'

type Wire<T> = T extends (infer Item)[]
  ? Wire<Item>[] | null
  : T extends object
    ? { [Key in keyof T]: Wire<T[Key]> }
    : T

const sourceLabel = (source: string) => {
  const keys: Record<string, string> = {
    'thb-wiki': 'data.sources.thbWiki',
    'doujin-meta': 'data.sources.doujinMeta',
    'local-json': 'data.sources.localJson',
    none: 'data.noCover',
    local: 'data.localCover',
  }
  return keys[source] ? t(keys[source]) : source
}

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

const normalizeIssue = <T extends { code: string; message: string; error?: ErrorInfo }>(
  issue: T,
): T => ({
  ...issue,
  message: issue.error ? errorMessage(issue.error) : issue.message || issueMessage(issue.code),
})

const optionLabel = (value: string, fallback: string) => {
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
    commit: 'backend.progress.committing',
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
    committing: 'backend.progress.committing',
    renaming: 'backend.progress.renaming',
    complete: 'backend.progress.complete',
  }
  const key = keys[progress.stage]
  return key ? t(key, { current: progress.current, total: progress.total }) : progress.message
}

const normalizeProgress = (progress: OperationProgress): OperationProgress => ({
  ...progress,
  message: progressMessage(progress),
})

const normalizeResult = <T extends Wire<OperationResult | BatchRunResult>>(result: T): T => {
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

const normalizeCandidate = (candidate: Wire<AlbumCandidate>): AlbumCandidate => ({
  ...candidate,
  sourceLabel: sourceLabel(candidate.source),
  artists: candidate.artists ?? [],
})

const normalizePlan = (plan: Wire<PlanPreview>): PlanPreview => ({
  ...plan,
  album: {
    ...plan.album,
    artists: plan.album.artists ?? [],
    genres: plan.album.genres ?? [],
  },
  candidate: normalizeCandidate(plan.candidate),
  cover: {
    ...plan.cover,
    sourceLabel: sourceLabel(plan.cover.source),
    compressionDescription:
      plan.cover.source === 'none' ? t('data.noCoverWrite') : t('data.coverReady'),
    issue: plan.cover.issue ? normalizeIssue(plan.cover.issue) : undefined,
  },
  items: (plan.items ?? []).map(item => ({
    ...item,
    artists: item.artists ?? [],
    issues: (item.issues ?? []).map(normalizeIssue),
  })),
  issues: (plan.issues ?? []).map(normalizeIssue),
})

const batchMatchDescription = (job: Wire<BatchJobPreview>) => {
  switch (job.status) {
    case 'loading':
      return t('batch.loading')
    case 'ignored':
      return t('batch.ignoredDescription')
    case 'scan-failed':
      return t('batch.loadFailed')
    case 'failed':
      return t('batch.status.failed')
    case 'needs-candidate':
      return job.candidates?.length
        ? t('batch.resultCount', { count: job.candidates.length })
        : t('data.candidateRequired')
    default:
      return t('batch.exactMatch')
  }
}

const normalizeBatchJob = (job: Wire<BatchJobPreview>): BatchJobPreview => ({
  ...job,
  issues: (job.issues ?? []).map(normalizeIssue),
  candidates: (job.candidates ?? []).map(normalizeCandidate),
  matchDescription: batchMatchDescription(job),
})

const normalizeBatch = (preview: Wire<BatchPreview>): BatchPreview => ({
  ...preview,
  jobs: (preview.jobs ?? []).map(normalizeBatchJob),
})

export const nativeApi: GUIApi = {
  getCapabilities: async () => {
    const capabilities = await SettingsService.GetCapabilities()
    return {
      ...capabilities,
      sources: (capabilities.sources ?? []).map(source => ({
        ...source,
        label: sourceLabel(source.value),
      })),
      commentLanguages: (capabilities.commentLanguages ?? []).map(option => ({
        ...option,
        label: optionLabel(option.value, option.label),
      })),
      lyricTypes: (capabilities.lyricTypes ?? []).map(option => ({
        ...option,
        label: optionLabel(option.value, option.label),
      })),
    }
  },
  getStartupDirectory: () => WorkspaceService.GetStartupDirectory(),
  selectAlbumDirectory: title => WorkspaceService.SelectAlbumDirectory(title),
  scanWorkspace: async directory => {
    const summary = (await WorkspaceService.ScanWorkspace(directory)) as Wire<WorkspaceSummary>
    return {
      ...summary,
      issues: (summary.issues ?? []).map(normalizeIssue),
      localCover: {
        ...summary.localCover,
        issue: summary.localCover.issue ? normalizeIssue(summary.localCover.issue) : undefined,
      },
    }
  },
  searchAlbums: async (directory, query, source) => {
    const candidates = (await WorkspaceService.SearchAlbums(directory, query, source)) as
      | AlbumCandidate[]
      | null
    return (candidates ?? []).map(normalizeCandidate)
  },
  preparePlan: async (directory, candidateId, source) =>
    normalizePlan(
      (await WorkspaceService.PreparePlan(directory, candidateId, source)) as Wire<PlanPreview>,
    ),
  updatePlan: async (patch: PlanPatch) =>
    normalizePlan((await WorkspaceService.UpdatePlan(patch)) as Wire<PlanPreview>),
  async discardPlan(planId) {
    await WorkspaceService.DiscardPlan(planId)
  },
  commitPlan: async (planId, revision) => await WorkspaceService.CommitPlan(planId, revision),
  startOperation: operationId => WorkspaceService.StartOperation(operationId),
  async cancelOperation(operationId) {
    await WorkspaceService.CancelOperation(operationId)
  },
  revealDirectory: directory => WorkspaceService.RevealDirectory(directory),
  selectBatchDirectory: title => BatchService.SelectBatchDirectory(title),
  scanBatch: async (directory, depth, source) =>
    normalizeBatch((await BatchService.ScanBatch(directory, depth, source)) as Wire<BatchPreview>),
  loadBatchJob: async (batchId, jobId) =>
    normalizeBatchJob((await BatchService.LoadBatchJob(batchId, jobId)) as Wire<BatchJobPreview>),
  resolveBatchCandidate: async (batchId, jobId, candidateId) => {
    const job = (await BatchService.ResolveBatchCandidate(
      batchId,
      jobId,
      candidateId,
    )) as Wire<BatchJobPreview>
    return normalizeBatchJob(job)
  },
  ignoreBatchJob: async (batchId, jobId) =>
    normalizeBatchJob((await BatchService.IgnoreBatchJob(batchId, jobId)) as Wire<BatchJobPreview>),
  discardBatch: batchId => BatchService.DiscardBatch(batchId),
  runBatch: async (batchId, failedOnly) => await BatchService.RunBatch(batchId, failedOnly),
  startBatch: operationId => BatchService.StartBatch(operationId),
  async cancelBatch(operationId) {
    await BatchService.CancelBatch(operationId)
  },
  loadSettings: async () => await SettingsService.LoadSettings(),
  saveSettings: async settings => await SettingsService.SaveSettings(settings),
  resetSettings: async () => await SettingsService.ResetSettings(),
  onProgress(handler) {
    return Events.On('gui:operation-progress', event =>
      handler(normalizeProgress(event.data as OperationProgress)),
    )
  },
  onComplete(handler) {
    return Events.On('gui:operation-complete', event => {
      const result = normalizeResult(event.data as Wire<OperationResult | BatchRunResult>)
      handler(
        'jobs' in result ? { ...result, jobs: (result.jobs ?? []).map(normalizeBatchJob) } : result,
      )
    })
  },
  onFailure(handler) {
    return Events.On('gui:operation-failed', event => {
      const failure = event.data as OperationFailure
      handler({
        ...failure,
        message: failure.error ? errorMessage(failure.error) : failure.message,
      })
    })
  },
  onProcessError(handler) {
    return Events.On('gui:process-error', event => {
      const error = event.data as ProcessError
      handler({
        ...error,
        message: error.error ? `${error.message}\n${errorMessage(error.error)}` : error.message,
        details: error.details || error.message,
      })
    })
  },
}

import { sourceLabel, t } from '../i18n'
import { normalizeIssue } from './nativeMessages'
import type { AlbumCandidate, BatchJobPreview, BatchPreview, PlanPreview } from './types'

export type Wire<T> = T extends (infer Item)[]
  ? Wire<Item>[] | null
  : T extends object
    ? { [Key in keyof T]: Wire<T[Key]> }
    : T

export const normalizeCandidate = (candidate: Wire<AlbumCandidate>): AlbumCandidate => ({
  ...candidate,
  sourceLabel: sourceLabel(candidate.source),
  artists: candidate.artists ?? [],
})

export const normalizePlan = (plan: Wire<PlanPreview>): PlanPreview => ({
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
    case 'no-audio':
      return t('batch.noAudio')
    case 'scan-failed':
      return t('batch.loadFailed')
    case 'blocked':
      return t('batch.status.blocked')
    case 'failed':
      return t('batch.status.failed')
    case 'needs-candidate':
      return job.candidates?.length
        ? t('batch.resultCount', { count: job.candidates.length })
        : t('data.candidateRequired')
    default:
      return job.candidates?.find(candidate => candidate.id === job.selectedCandidateId)
        ?.exactMatch === false
        ? job.matchDescription
        : t('batch.exactMatch')
  }
}

export const normalizeBatchJob = (job: Wire<BatchJobPreview>): BatchJobPreview => ({
  ...job,
  issues: (job.issues ?? []).map(normalizeIssue),
  candidates: (job.candidates ?? []).map(normalizeCandidate),
  matchDescription: batchMatchDescription(job),
})

export const normalizeBatch = (preview: Wire<BatchPreview>): BatchPreview => ({
  ...preview,
  jobs: (preview.jobs ?? []).map(normalizeBatchJob),
})

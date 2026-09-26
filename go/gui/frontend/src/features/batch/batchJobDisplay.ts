import type { BatchJobPreview, BatchJobStatus } from '../../api'
import { t } from '../../i18n'

export const statusInfo = (status: BatchJobStatus) => {
  const map: Record<
    BatchJobStatus,
    { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' }
  > = {
    loading: { label: t('batch.status.loading'), severity: 'info' },
    ready: { label: t('batch.status.ready'), severity: 'success' },
    'needs-candidate': { label: t('batch.status.needsCandidate'), severity: 'warn' },
    'local-metadata': { label: t('batch.status.localMetadata'), severity: 'info' },
    blocked: { label: t('batch.status.blocked'), severity: 'danger' },
    'scan-failed': { label: t('batch.loadFailed'), severity: 'danger' },
    'no-audio': { label: t('batch.noAudio'), severity: 'secondary' },
    queued: { label: t('batch.status.queued'), severity: 'secondary' },
    running: { label: t('batch.status.running'), severity: 'info' },
    succeeded: { label: t('batch.status.succeeded'), severity: 'success' },
    failed: { label: t('batch.status.failed'), severity: 'danger' },
    cancelled: { label: t('batch.status.cancelled'), severity: 'secondary' },
  }
  return map[status]
}

export const candidateOptions = (job: BatchJobPreview) =>
  job.candidates.map(candidate => ({
    value: candidate.id,
    candidate,
    label: [candidate.title, candidate.artists.join(' / ')].filter(Boolean).join(' · '),
  }))

import type { BatchJobPreview } from '../../../shared/api'

export const candidateOptions = (job: BatchJobPreview) =>
  job.candidates.map(candidate => ({
    value: candidate.id,
    candidate,
    label: [candidate.title, candidate.artists.join(' / ')].filter(Boolean).join(' · '),
  }))

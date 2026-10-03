import type { BatchEntryPreview } from '../../../shared/api'

export const candidateOptions = (entry: BatchEntryPreview) =>
  entry.candidates.map(candidate => ({
    value: candidate.id,
    candidate,
    label: [candidate.title, candidate.artists.join(' / ')].filter(Boolean).join(' · '),
  }))

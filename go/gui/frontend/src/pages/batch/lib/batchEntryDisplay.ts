import type { BatchEntryPreview } from '../../../shared/api'
import { t } from '../../../shared/i18n'

export const candidateOptions = (entry: BatchEntryPreview) =>
  entry.candidates.map(candidate => ({
    value: candidate.id,
    candidate,
    label: candidate.artists.length
      ? t('batch.candidateLabel', {
          title: candidate.title,
          artists: candidate.artists.join(' / '),
        })
      : candidate.title,
  }))

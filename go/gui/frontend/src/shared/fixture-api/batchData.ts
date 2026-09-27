import multipleDiscFixture from '../../../../../../fixtures/thb-wiki/albums/multiple-disc/expected.json'
import noCoverFixture from '../../../../../../fixtures/thb-wiki/albums/no-cover/expected.json'
import singleDiscFixture from '../../../../../../fixtures/thb-wiki/albums/single-disc/expected.json'
import type { BatchJobPreview } from '../api/types'
import { t } from '../i18n'
import { candidates } from './data'

export const batchJobs = (): BatchJobPreview[] => [
  {
    id: 'fixture-job-single',
    relativePath: singleDiscFixture.album.album,
    inferredAlbumName: singleDiscFixture.album.album,
    source: 'thb-wiki',
    audioCount: singleDiscFixture.tracks.length,
    readiness: 'ready',
    issues: [],
    candidates: [candidates[0]],
    selectedCandidateId: candidates[0].id,
  },
  {
    id: 'fixture-job-multiple',
    relativePath: multipleDiscFixture.album.album,
    inferredAlbumName: multipleDiscFixture.album.album,
    source: 'thb-wiki',
    audioCount: multipleDiscFixture.tracks.length,
    readiness: 'needs-candidate',
    issues: [
      {
        code: 'candidate-required',
        message: t('data.candidateRequired'),
        severity: 'warning',
      },
    ],
    candidates: [candidates[1], candidates[0]],
  },
  {
    id: 'fixture-job-no-cover',
    relativePath: noCoverFixture.album.album,
    inferredAlbumName: noCoverFixture.album.album,
    source: 'thb-wiki',
    audioCount: noCoverFixture.tracks.length,
    readiness: 'ready',
    issues: [],
    candidates: [candidates[2]],
    selectedCandidateId: candidates[2].id,
  },
]

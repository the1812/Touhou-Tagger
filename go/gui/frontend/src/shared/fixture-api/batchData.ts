import multipleDiscFixture from '../../../../../../fixtures/thb-wiki/albums/multiple-disc/expected.json'
import noCoverFixture from '../../../../../../fixtures/thb-wiki/albums/no-cover/expected.json'
import singleDiscFixture from '../../../../../../fixtures/thb-wiki/albums/single-disc/expected.json'
import type { BatchEntryPreview } from '../api/types'
import { t } from '../i18n'
import { candidates } from './data'

export const batchEntries = (): BatchEntryPreview[] => [
  {
    id: 'fixture-entry-single',
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
    id: 'fixture-entry-multiple',
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
    id: 'fixture-entry-no-cover',
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

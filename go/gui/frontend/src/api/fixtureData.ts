import coverUrl from '../../../../../fixtures/media/images/cover.jpg?url'
import multipleDiscFixture from '../../../../../fixtures/thb-wiki/albums/multiple-disc/expected.json'
import noCoverFixture from '../../../../../fixtures/thb-wiki/albums/no-cover/expected.json'
import singleDiscFixture from '../../../../../fixtures/thb-wiki/albums/single-disc/expected.json'
import { t } from '../i18n'
import type {
  AlbumCandidate,
  AlbumMetadata,
  BatchJobPreview,
  Capabilities,
  PlanItemPreview,
  PlanPreview,
  Settings,
  WorkspaceSummary,
} from './types'

type AlbumFixture = typeof singleDiscFixture

export const fixtureDirectory = 'D:/Music/Touhou/Album'
export const batchDirectory = 'D:/Music/Touhou'

export const capabilities: Capabilities = {
  sources: [
    { value: 'thb-wiki', label: 'THBWiki', supportsSearch: true },
    { value: 'local-json', label: '本地 metadata.json', supportsSearch: false },
  ],
  commentLanguages: [
    { value: 'zh-Hans', label: t('data.simplifiedChinese') },
    { value: 'ja', label: t('data.japanese') },
  ],
  lyricTypes: [
    { value: 'original', label: t('data.original') },
    { value: 'translated', label: t('data.translated') },
    { value: 'mixed', label: t('data.mixed') },
  ],
}

export const defaultSettings: Settings = {
  defaultSource: 'thb-wiki',
  commentLanguage: 'zh-Hans',
  mp3MultiValueSeparator: ' / ',
  requestTimeoutSeconds: 20,
  retryCount: 2,
  coverCompressionThresholdKb: 1500,
  coverMaxEdge: 2000,
  lyricType: 'mixed',
  writeLyricsMetadata: true,
  writeLrcFiles: false,
  preserveLyricTimeline: true,
  mixedLyricSeparator: ' / ',
  lyricCacheSize: 128,
}

const fixtureCandidate = (
  fixture: AlbumFixture,
  id: string,
  exactMatch: boolean,
): AlbumCandidate => ({
  id,
  title: fixture.album.album,
  source: 'thb-wiki',
  sourceLabel: 'THBWiki',
  albumOrder: fixture.album.albumOrder,
  artists: fixture.album.albumArtists,
  year: fixture.album.year,
  exactMatch,
  description: `${String(fixture.tracks.length)} 首曲目 · ${fixture.album.genres.join('、')}`,
})

export const candidates = [
  fixtureCandidate(singleDiscFixture, 'fixture:single-disc', true),
  fixtureCandidate(multipleDiscFixture, 'fixture:multiple-disc', false),
  fixtureCandidate(noCoverFixture, 'fixture:no-cover', false),
]

const fixtureByCandidate = new Map<string, AlbumFixture>([
  ['fixture:single-disc', singleDiscFixture],
  ['fixture:multiple-disc', multipleDiscFixture],
  ['fixture:no-cover', noCoverFixture],
])

export const workspaceSummary: WorkspaceSummary = {
  directory: fixtureDirectory,
  audioCount: singleDiscFixture.tracks.length,
  mp3Count: singleDiscFixture.tracks.length,
  flacCount: 0,
  localCover: {
    exists: true,
    valid: true,
    fileName: 'cover.jpg',
  },
  hasMetadataJson: false,
  hasAlbumConfig: false,
  inferredAlbumName: singleDiscFixture.album.album,
  effectiveSource: 'thb-wiki',
  issues: [],
}

const albumMetadata = (fixture: AlbumFixture): AlbumMetadata => ({
  title: fixture.album.album,
  albumOrder: fixture.album.albumOrder,
  artists: fixture.album.albumArtists,
  year: fixture.album.year,
  genres: fixture.album.genres,
})

const planItem = (track: AlbumFixture['tracks'][number], index: number): PlanItemPreview => {
  const prefix =
    track.discNumber === '1'
      ? track.trackNumber.padStart(2, '0')
      : `${track.discNumber}-${track.trackNumber.padStart(2, '0')}`
  const targetName = `${prefix}. ${track.title}.mp3`

  return {
    id: `fixture-track-${String(index + 1)}`,
    sourceName: `${prefix} ${track.title}.mp3`,
    format: 'MP3',
    discNumber: track.discNumber,
    trackNumber: track.trackNumber,
    title: track.title,
    artists: track.artists,
    comments: track.comments,
    targetName,
    willRename: true,
    issues: [],
  }
}

export const createPlan = (
  candidateId: string,
  revision = 1,
  album?: AlbumMetadata,
  items?: PlanItemPreview[],
  saveCover?: boolean,
): PlanPreview => {
  const fixture = fixtureByCandidate.get(candidateId) ?? singleDiscFixture
  const candidate = candidates.find(item => item.id === candidateId) ?? candidates[0]
  const planItems = items ?? fixture.tracks.map(planItem)
  const hasCover = fixture.cover

  return {
    planId: 'fixture-plan',
    revision,
    directory: fixtureDirectory,
    album: album ?? albumMetadata(fixture),
    candidate,
    cover: hasCover
      ? {
          url: coverUrl,
          source: 'thb-wiki',
          sourceLabel: 'THBWiki 封面',
          width: 600,
          height: 600,
          byteSize: 43246,
          compressionDescription: '低于 1500 KB 阈值，将保留原始图片',
        }
      : {
          url: '',
          source: 'none',
          sourceLabel: t('data.noCover'),
          width: 0,
          height: 0,
          byteSize: 0,
          compressionDescription: t('data.noCoverWrite'),
        },
    items: planItems,
    issues: [],
    options: {
      writeFiles: planItems.length,
      renameFiles: planItems.filter(item => item.willRename).length,
      canSaveCover: hasCover,
      saveCover: saveCover ?? hasCover,
      compressCover: false,
      lrcFiles: 0,
    },
    canCommit: true,
  }
}

export const batchJobs = (): BatchJobPreview[] => [
  {
    id: 'fixture-job-single',
    relativePath: singleDiscFixture.album.album,
    inferredAlbumName: singleDiscFixture.album.album,
    source: 'thb-wiki',
    matchDescription: '精确匹配',
    audioCount: singleDiscFixture.tracks.length,
    status: 'ready',
    issues: [],
    candidates: [candidates[0]],
    selectedCandidateId: candidates[0].id,
  },
  {
    id: 'fixture-job-multiple',
    relativePath: multipleDiscFixture.album.album,
    inferredAlbumName: multipleDiscFixture.album.album,
    source: 'thb-wiki',
    matchDescription: '多个搜索结果',
    audioCount: multipleDiscFixture.tracks.length,
    status: 'needs-candidate',
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
    matchDescription: '精确匹配',
    audioCount: noCoverFixture.tracks.length,
    status: 'ready',
    issues: [],
    candidates: [candidates[2]],
    selectedCandidateId: candidates[2].id,
  },
]

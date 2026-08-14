import coverUrl from '../../../../../fixtures/media/images/cover.jpg?url'
import multipleDiscFixture from '../../../../../fixtures/thb-wiki/albums/multiple-disc/expected.json'
import noCoverFixture from '../../../../../fixtures/thb-wiki/albums/no-cover/expected.json'
import singleDiscFixture from '../../../../../fixtures/thb-wiki/albums/single-disc/expected.json'

import type {
  AlbumCandidate,
  AlbumMetadata,
  BatchJobPreview,
  BatchPreview,
  BatchRunResult,
  Capabilities,
  GUIApi,
  OperationFailure,
  OperationProgress,
  OperationResult,
  PlanItemPreview,
  PlanPatch,
  PlanPreview,
  ProcessError,
  Settings,
  WorkspaceSummary,
} from './types'

type AlbumFixture = typeof singleDiscFixture

const fixtureDirectory = 'fixtures/thb-wiki/albums/single-disc'
const batchDirectory = 'fixtures/thb-wiki/albums'

const progressHandlers = new Set<(progress: OperationProgress) => void>()
const completeHandlers = new Set<(result: OperationResult | BatchRunResult) => void>()
const failureHandlers = new Set<(failure: OperationFailure) => void>()
const processErrorHandlers = new Set<(error: ProcessError) => void>()
const operationTimers = new Map<string, number>()
const pendingStarts = new Map<
  string,
  { kind: 'workspace' | 'batch'; start: () => void }
>()
const operationCancels = new Map<string, () => void>()

const clone = <T>(value: T): T => structuredClone(value)
const wait = (duration = 80) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration)
  })

const capabilities: Capabilities = {
  sources: [
    { value: 'thb-wiki', label: 'THBWiki', supportsSearch: true },
    { value: 'local-json', label: '本地 metadata.json', supportsSearch: false },
  ],
  commentLanguages: [
    { value: 'zh-Hans', label: '简体中文' },
    { value: 'ja', label: '日本語' },
  ],
  lyricTypes: [
    { value: 'original', label: '原文' },
    { value: 'translated', label: '译文' },
    { value: 'mixed', label: '混合' },
  ],
}

const defaultSettings: Settings = {
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

let settings = clone(defaultSettings)

const fixtureCandidate = (
  fixture: AlbumFixture,
  id: string,
  exactMatch: boolean,
): AlbumCandidate => ({
  id,
  title: fixture.album.album,
  source: 'thb-wiki',
  sourceLabel: 'THBWiki fixture',
  albumOrder: fixture.album.albumOrder,
  artists: fixture.album.albumArtists,
  year: fixture.album.year,
  exactMatch,
  description: `${fixture.tracks.length} 首曲目 · ${fixture.album.genres.join('、')}`,
})

const candidates = [
  fixtureCandidate(singleDiscFixture, 'fixture:single-disc', true),
  fixtureCandidate(multipleDiscFixture as AlbumFixture, 'fixture:multiple-disc', false),
  fixtureCandidate(noCoverFixture as AlbumFixture, 'fixture:no-cover', false),
]

const fixtureByCandidate = new Map<string, AlbumFixture>([
  ['fixture:single-disc', singleDiscFixture],
  ['fixture:multiple-disc', multipleDiscFixture as AlbumFixture],
  ['fixture:no-cover', noCoverFixture as AlbumFixture],
])

const workspaceSummary: WorkspaceSummary = {
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

const planItem = (
  track: AlbumFixture['tracks'][number],
  index: number,
): PlanItemPreview => {
  const prefix = track.discNumber === '1' ? track.trackNumber.padStart(2, '0') : `${track.discNumber}-${track.trackNumber.padStart(2, '0')}`
  const targetName = `${prefix}. ${track.title}.mp3`

  return {
    id: `fixture-track-${index + 1}`,
    sourceName: `track-${String(index + 1).padStart(2, '0')}.mp3`,
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

const createPlan = (
  candidateId: string,
  revision = 1,
  album?: AlbumMetadata,
  items?: PlanItemPreview[],
  saveCover?: boolean,
): PlanPreview => {
  const fixture = fixtureByCandidate.get(candidateId) ?? singleDiscFixture
  const candidate = candidates.find((item) => item.id === candidateId) ?? candidates[0]
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
          sourceLabel: 'THBWiki 封面（离线 fixture）',
          width: 600,
          height: 600,
          byteSize: 43_246,
          compressionDescription: '低于 1500 KB 阈值，将保留原始图片',
        }
      : {
          url: '',
          source: 'none',
          sourceLabel: '无封面',
          width: 0,
          height: 0,
          byteSize: 0,
          compressionDescription: '此专辑不会写入封面',
        },
    items: planItems,
    issues: [],
    options: {
      writeFiles: planItems.length,
      renameFiles: planItems.filter((item) => item.willRename).length,
      canSaveCover: hasCover,
      saveCover: saveCover ?? hasCover,
      compressCover: false,
      lrcFiles: 0,
    },
    canCommit: true,
  }
}

let activePlan = createPlan('fixture:single-disc')

const batchJobs = (): BatchJobPreview[] => [
  {
    id: 'fixture-job-single',
    relativePath: 'single-disc',
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
    relativePath: 'multiple-disc',
    inferredAlbumName: multipleDiscFixture.album.album,
    source: 'thb-wiki',
    matchDescription: '多个搜索结果',
    audioCount: multipleDiscFixture.tracks.length,
    status: 'needs-candidate',
    issues: [
      {
        code: 'candidate-required',
        message: '写入前需要选择匹配的专辑。',
        severity: 'warning',
      },
    ],
    candidates: [candidates[1], candidates[0]],
  },
  {
    id: 'fixture-job-no-cover',
    relativePath: 'no-cover',
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

let activeBatch: BatchPreview = {
  batchId: 'fixture-batch',
  rootDirectory: batchDirectory,
  depth: 2,
  jobs: batchJobs(),
}

const emitSequence = (
  operationId: string,
  kind: 'workspace' | 'batch',
  total: number,
  onDone: () => OperationResult | BatchRunResult,
  onCancel: () => OperationResult | BatchRunResult,
) => {
  const stages: OperationProgress['stage'][] =
    kind === 'workspace'
      ? ['preparing', 'writing', 'writing', 'committing', 'renaming']
      : ['preparing', 'writing', 'writing', 'writing', 'committing']
  let index = 0

  const timer = window.setInterval(() => {
    const stage = stages[index]
    const current = Math.min(total, Math.ceil(((index + 1) / stages.length) * total))
    const progress: OperationProgress = {
      operationId,
      kind,
      stage,
      current,
      total,
      path: kind === 'workspace' ? activePlan.items[Math.min(current - 1, activePlan.items.length - 1)]?.sourceName : `fixture-album-${current}`,
      message:
        stage === 'committing'
          ? '正在保存文件'
          : stage === 'renaming'
            ? '正在重命名'
            : `正在处理 ${current} / ${total}`,
      cancellable: stage === 'preparing' || stage === 'writing',
    }
    progressHandlers.forEach((handler) => handler(progress))
    index += 1

    if (index === stages.length) {
      window.clearInterval(timer)
      operationTimers.delete(operationId)
      operationCancels.delete(operationId)
      completeHandlers.forEach((handler) => handler(onDone()))
    }
  }, 260)
  operationTimers.set(operationId, timer)
  operationCancels.set(operationId, () => {
    window.clearInterval(timer)
    operationTimers.delete(operationId)
    operationCancels.delete(operationId)
    completeHandlers.forEach((handler) => handler(onCancel()))
  })
}

export const fixtureApi: GUIApi = {
  async getCapabilities() {
    await wait()
    return clone(capabilities)
  },

  async getStartupDirectory() {
    return ''
  },

  async selectAlbumDirectory() {
    await wait()
    return fixtureDirectory
  },

  async scanWorkspace(directory) {
    await wait(160)
    return { ...clone(workspaceSummary), directory }
  },

  async searchAlbums(_directory, query) {
    await wait(220)
    const normalized = query.trim().toLocaleLowerCase()
    return clone(
      normalized
        ? candidates.filter((candidate) => candidate.title.toLocaleLowerCase().includes(normalized) || candidate.exactMatch)
        : candidates,
    )
  },

  async preparePlan(_directory, candidateId) {
    await wait(200)
    activePlan = createPlan(candidateId)
    return clone(activePlan)
  },

  async updatePlan(patch: PlanPatch) {
    await wait(120)
    const album = { ...activePlan.album, ...patch.album }
    const changedTracks = new Map(patch.tracks?.map((track) => [track.id, track]) ?? [])
    const items = activePlan.items.map((item) => {
      const change = changedTracks.get(item.id)
      if (!change) {
        return item
      }
      const updated = { ...item, ...change }
      const prefix =
        updated.discNumber === '1'
          ? updated.trackNumber.padStart(2, '0')
          : `${updated.discNumber}-${updated.trackNumber.padStart(2, '0')}`
      return { ...updated, targetName: `${prefix}. ${updated.title}.mp3` }
    })
    activePlan = createPlan(
      activePlan.candidate.id,
      activePlan.revision + 1,
      album,
      items,
      patch.saveCover ?? activePlan.options.saveCover,
    )
    return clone(activePlan)
  },

  async discardPlan() {
    await wait()
  },

  async commitPlan() {
    const operationId = `fixture-workspace-${Date.now()}`
    pendingStarts.set(operationId, {
      kind: 'workspace',
      start: () =>
        emitSequence(
          operationId,
          'workspace',
          activePlan.items.length,
          () => ({
            operationId,
            kind: 'workspace',
            succeeded: activePlan.items.length,
            failed: 0,
            renamed: activePlan.options.renameFiles,
            coversSaved: activePlan.options.saveCover ? 1 : 0,
            lrcFiles: activePlan.options.lrcFiles,
            durationMs: 1840,
            cancelled: false,
            message: 'fixture 写入演示完成，未修改任何文件。',
          }),
          () => ({
            operationId,
            kind: 'workspace',
            succeeded: 0,
            failed: 0,
            renamed: 0,
            coversSaved: 0,
            lrcFiles: 0,
            durationMs: 320,
            cancelled: true,
            message: '已取消 fixture 操作，写入内容仍可继续使用。',
          }),
        ),
    })
    return { operationId }
  },

  async startOperation(operationId) {
    const pending = pendingStarts.get(operationId)
    if (!pending || pending.kind !== 'workspace') {
      throw new Error('Fixture 写入操作不存在或已经开始。')
    }
    pendingStarts.delete(operationId)
    pending.start()
  },

  async cancelOperation(operationId) {
    await wait()
    if (pendingStarts.delete(operationId)) {
      return
    }
    operationCancels.get(operationId)?.()
  },

  async revealDirectory() {
    await wait()
  },

  async selectBatchDirectory() {
    await wait()
    return batchDirectory
  },

  async scanBatch(directory, depth) {
    await wait(220)
    activeBatch = {
      batchId: 'fixture-batch',
      rootDirectory: directory,
      depth,
      jobs: batchJobs(),
    }
    return clone(activeBatch)
  },

  async resolveBatchCandidate(_batchId, jobId, candidateId) {
    await wait(120)
    const job = activeBatch.jobs.find((item) => item.id === jobId)
    if (!job) {
      throw new Error('Fixture 批量写入专辑不存在。')
    }
    job.selectedCandidateId = candidateId
    job.status = 'ready'
    job.matchDescription = '已选择搜索结果'
    job.issues = []
    return clone(job)
  },

  async ignoreBatchJob(_batchId, jobId) {
    await wait(120)
    const job = activeBatch.jobs.find((item) => item.id === jobId)
    if (!job) {
      throw new Error('Fixture 批量写入专辑不存在。')
    }
    job.selectedCandidateId = undefined
    job.status = 'ignored'
    job.matchDescription = '已由用户忽略'
    job.issues = []
    return clone(job)
  },

  async discardBatch() {
    await wait()
  },

  async runBatch(_batchId, failedOnly) {
    const operationId = `fixture-batch-${Date.now()}`
    const jobs = failedOnly
      ? activeBatch.jobs.filter((job) => job.status === 'failed')
      : activeBatch.jobs
    pendingStarts.set(operationId, {
      kind: 'batch',
      start: () =>
        emitSequence(
          operationId,
          'batch',
          Math.max(jobs.length, 1),
          () => {
            activeBatch.jobs = activeBatch.jobs.map((job) => ({
              ...job,
              status: job.status === 'ignored' ? 'ignored' : 'succeeded',
            }))
            return {
              operationId,
              kind: 'batch',
              succeeded: activeBatch.jobs.filter((job) => job.status === 'succeeded')
                .length,
              failed: 0,
              renamed: 25,
              coversSaved: 2,
              lrcFiles: 0,
              durationMs: 2830,
              cancelled: false,
              message: 'fixture 批量写入演示完成，未修改任何文件。',
              jobs: clone(activeBatch.jobs),
            }
          },
          () => {
            activeBatch.jobs = activeBatch.jobs.map((job) =>
              jobs.some((selected) => selected.id === job.id)
                ? { ...job, status: 'cancelled' }
                : job,
            )
            return {
              operationId,
              kind: 'batch',
              succeeded: 0,
              failed: 0,
              renamed: 0,
              coversSaved: 0,
              lrcFiles: 0,
              durationMs: 320,
              cancelled: true,
              message: '已停止写入后续 fixture 专辑。',
              jobs: clone(activeBatch.jobs),
            }
          },
        ),
    })
    return { operationId }
  },

  async startBatch(operationId) {
    const pending = pendingStarts.get(operationId)
    if (!pending || pending.kind !== 'batch') {
      throw new Error('Fixture 批量写入操作不存在或已经开始。')
    }
    pendingStarts.delete(operationId)
    pending.start()
  },

  async cancelBatch(operationId) {
    if (pendingStarts.delete(operationId)) {
      return
    }
    operationCancels.get(operationId)?.()
  },

  async loadSettings() {
    await wait()
    return clone(settings)
  },

  async saveSettings(nextSettings) {
    await wait(120)
    settings = clone(nextSettings)
    return clone(settings)
  },

  async resetSettings() {
    await wait()
    settings = clone(defaultSettings)
    return clone(settings)
  },

  onProgress(handler) {
    progressHandlers.add(handler)
    return () => progressHandlers.delete(handler)
  },

  onComplete(handler) {
    completeHandlers.add(handler)
    return () => completeHandlers.delete(handler)
  },

  onFailure(handler) {
    failureHandlers.add(handler)
    return () => failureHandlers.delete(handler)
  },

  onProcessError(handler) {
    processErrorHandlers.add(handler)
    return () => processErrorHandlers.delete(handler)
  },
}

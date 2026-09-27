import type { PlanPatch, WorkspaceApi } from '../types'
import { candidates, createPlan, fixtureDirectory, workspaceSummary } from './data'
import { clone, emitSequence, fixtureState, wait } from './state'

export const fixtureWorkspaceApi: WorkspaceApi = {
  async selectAlbumDirectory() {
    await wait()
    return fixtureDirectory
  },

  async scanWorkspace(directory) {
    await wait(160)
    return { ...clone(workspaceSummary), directory }
  },

  async searchAlbums(_directory, query, source = fixtureState.settings.defaultSource) {
    await wait(220)
    const normalized = query.trim().toLocaleLowerCase()
    return clone(
      candidates.filter(
        candidate =>
          candidate.source === source &&
          (!normalized ||
            candidate.title.toLocaleLowerCase().includes(normalized) ||
            candidate.exactMatch),
      ),
    )
  },

  async preparePlan(_directory, candidateId) {
    await wait(200)
    fixtureState.activeCandidateId = candidateId
    fixtureState.activePlan = createPlan(candidateId)
    return clone(fixtureState.activePlan)
  },

  async updatePlan(patch: PlanPatch) {
    patch = clone(patch)
    await wait(120)
    const previousAlbum = fixtureState.activePlan.album
    const album = {
      ...previousAlbum,
      ...(patch.album?.title != null ? { title: patch.album.title } : {}),
      ...(patch.album?.albumOrder != null ? { albumOrder: patch.album.albumOrder } : {}),
      ...(patch.album?.artists != null ? { artists: patch.album.artists } : {}),
      ...(patch.album?.year != null ? { year: patch.album.year } : {}),
      ...(patch.album?.genres != null ? { genres: patch.album.genres } : {}),
    }
    const changedTracks = new Map((patch.tracks ?? []).map(track => [track.id, track]))
    const items = fixtureState.activePlan.items.map(item => {
      const change = changedTracks.get(item.id)
      if (!change) {
        return item
      }
      const updated = { ...item }
      if (change.discNumber != null) {
        updated.discNumber = change.discNumber
      }
      if (change.trackNumber != null) {
        updated.trackNumber = change.trackNumber
      }
      if (change.title != null) {
        updated.title = change.title
      }
      if (change.artists != null) {
        updated.artists = change.artists
      }
      if (change.comments != null) {
        updated.comments = change.comments
      }
      const prefix =
        updated.discNumber === '1'
          ? updated.trackNumber.padStart(2, '0')
          : `${updated.discNumber}-${updated.trackNumber.padStart(2, '0')}`
      return { ...updated, targetName: `${prefix}. ${updated.title}.mp3` }
    })
    fixtureState.activePlan = createPlan(
      fixtureState.activeCandidateId,
      fixtureState.activePlan.revision + 1,
      album,
      items,
      patch.saveCover ?? fixtureState.activePlan.options.saveCover,
    )
    return clone(fixtureState.activePlan)
  },

  async discardPlan() {
    await wait()
  },

  commitPlan() {
    const operationId = `fixture-workspace-${String(Date.now())}`
    fixtureState.pendingStarts.set(operationId, {
      kind: 'workspace',
      start: () =>
        emitSequence(
          operationId,
          'workspace',
          fixtureState.activePlan.items.length,
          () => {
            const renamed = fixtureState.activePlan.options.renameFiles
            fixtureState.activePlan = {
              ...fixtureState.activePlan,
              revision: fixtureState.activePlan.revision + 1,
              items: fixtureState.activePlan.items.map(item => ({
                ...item,
                sourceName: item.targetName,
                willRename: false,
              })),
              options: { ...fixtureState.activePlan.options, renameFiles: 0 },
            }
            return {
              operationId,
              kind: 'workspace',
              succeeded: fixtureState.activePlan.items.length,
              failed: 0,
              renamed,
              coversSaved: fixtureState.activePlan.options.saveCover ? 1 : 0,
              lrcFiles: fixtureState.activePlan.options.lrcFiles,
              durationMs: 1840,
              cancelled: false,
              message: '写入完成。',
              plan: clone(fixtureState.activePlan),
            }
          },
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
            message: '已取消写入。',
            plan: clone(fixtureState.activePlan),
          }),
        ),
      cancel: () =>
        fixtureState.completeHandlers.forEach(handler =>
          handler({
            operationId,
            kind: 'workspace',
            succeeded: 0,
            failed: 0,
            renamed: 0,
            coversSaved: 0,
            lrcFiles: 0,
            durationMs: 0,
            cancelled: true,
            message: '已取消写入。',
            plan: clone(fixtureState.activePlan),
          }),
        ),
    })
    return Promise.resolve({ operationId })
  },

  startOperation(operationId) {
    const pending = fixtureState.pendingStarts.get(operationId)
    if (!pending || pending.kind !== 'workspace') {
      return Promise.reject(new Error('写入操作不存在或已经开始。'))
    }
    fixtureState.pendingStarts.delete(operationId)
    pending.start()
    return Promise.resolve()
  },

  async cancelOperation(operationId) {
    await wait()
    const pending = fixtureState.pendingStarts.get(operationId)
    if (pending?.kind === 'workspace') {
      fixtureState.pendingStarts.delete(operationId)
      pending.cancel()
      return
    }
    fixtureState.operationCancels.get(operationId)?.()
  },
}

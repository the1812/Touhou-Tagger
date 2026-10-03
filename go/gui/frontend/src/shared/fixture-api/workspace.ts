import type { PlanPatch, WorkspaceApi, WorkspaceWriteOperationResult } from '../api/types'
import { candidates, createPlan, fixtureDirectory, workspaceSummary } from './data'
import { clone, executeSequence, fixtureState, wait } from './state'

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
      candidates.filter(candidate => {
        if (candidate.source !== source) {
          return false
        }
        return (
          !normalized ||
          candidate.title.toLocaleLowerCase().includes(normalized) ||
          candidate.exactMatch
        )
      }),
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

  executePlan(_planId, operationId) {
    return executeSequence<WorkspaceWriteOperationResult>(
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
    )
  },

  cancelWriteOperation(operationId) {
    if (fixtureState.operationCancel?.id === operationId) {
      fixtureState.operationCancel.cancel()
    }
    return Promise.resolve()
  },
}

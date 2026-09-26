import { getApi, type AlbumMetadataPatch, type TrackMetadataPatch } from '../api'
import { t } from '../i18n'
import type { WorkspaceContext } from './workspaceContext'

export const createWorkspaceEditing = (context: WorkspaceContext) => {
  const { plan, phase, isBusy, notifications, contextVersion } = context
  const updateAlbum = async (album: AlbumMetadataPatch) => {
    if (!plan.value || isBusy.value) {
      return
    }
    contextVersion.value += 1
    const requestVersion = contextVersion.value
    phase.value = 'editing'
    try {
      const api = await getApi()
      const nextPlan = await api.updatePlan({
        planId: plan.value.planId,
        revision: plan.value.revision,
        album,
      })
      if (requestVersion !== contextVersion.value) {
        return
      }
      plan.value = nextPlan
      phase.value = 'ready'
    } catch (error) {
      if (requestVersion !== contextVersion.value) {
        return
      }
      phase.value = 'ready'
      notifications.error(t('notifications.updateAlbumFailed'), error)
    }
  }

  const updateTrack = async (track: TrackMetadataPatch) => {
    if (!plan.value || isBusy.value) {
      return
    }
    contextVersion.value += 1
    const requestVersion = contextVersion.value
    phase.value = 'editing'
    try {
      const api = await getApi()
      const nextPlan = await api.updatePlan({
        planId: plan.value.planId,
        revision: plan.value.revision,
        tracks: [track],
      })
      if (requestVersion !== contextVersion.value) {
        return
      }
      plan.value = nextPlan
      phase.value = 'ready'
    } catch (error) {
      if (requestVersion !== contextVersion.value) {
        return
      }
      phase.value = 'ready'
      notifications.error(t('notifications.updateTrackFailed'), error)
    }
  }

  const updateSaveCover = async (saveCover: boolean) => {
    if (!plan.value || isBusy.value || !plan.value.options.canSaveCover) {
      return
    }
    contextVersion.value += 1
    const requestVersion = contextVersion.value
    phase.value = 'editing'
    try {
      const api = await getApi()
      const nextPlan = await api.updatePlan({
        planId: plan.value.planId,
        revision: plan.value.revision,
        saveCover,
      })
      if (requestVersion !== contextVersion.value) {
        return
      }
      plan.value = nextPlan
      phase.value = 'ready'
    } catch (error) {
      if (requestVersion !== contextVersion.value) {
        return
      }
      phase.value = 'ready'
      notifications.error(t('notifications.updateCoverOptionFailed'), error)
    }
  }

  return { updateAlbum, updateTrack, updateSaveCover }
}

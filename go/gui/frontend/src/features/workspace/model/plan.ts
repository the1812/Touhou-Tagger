import { computed, type Ref } from 'vue'

import { useNotificationsStore } from '../../../entities/session'
import {
  getApi,
  type AlbumMetadata,
  type TrackMetadata,
  type WorkspaceApi,
  type PlanPreview,
  type WorkspaceSummary,
} from '../../../shared/api'
import { t } from '../../../shared/i18n'

export const useWorkspacePlan = (state: {
  plan: Ref<PlanPreview | undefined>
  stalePlan: Ref<boolean>
  summary: Ref<WorkspaceSummary | undefined>
  activity: Ref<'editing' | 'opening' | 'preparing' | 'searching' | 'selecting' | undefined>
  isBusy: Readonly<Ref<boolean>>
}) => {
  const notifications = useNotificationsStore()
  const blockingIssues = computed(() => {
    const issues = [
      ...(state.summary.value?.issues ?? []),
      ...(state.plan.value?.issues ?? []),
      ...(state.plan.value?.cover.issue ? [state.plan.value.cover.issue] : []),
      ...(state.plan.value?.items.flatMap(item => item.issues) ?? []),
    ]
    return issues.filter(issue => issue.severity === 'error')
  })
  const canExecute = computed(
    () => Boolean(state.plan.value?.canExecute) && !state.stalePlan.value && !state.isBusy.value,
  )

  const update = async (
    request: (api: WorkspaceApi, planId: string) => Promise<PlanPreview>,
    failureTitle: string,
  ) => {
    const current = state.plan.value
    if (!current || state.isBusy.value || state.stalePlan.value) {
      return false
    }
    state.activity.value = 'editing'
    try {
      const next = await request(await getApi(), current.planId)
      state.plan.value = next
      state.stalePlan.value = false
      return true
    } catch (error) {
      notifications.error(failureTitle, error)
      return false
    } finally {
      state.activity.value = undefined
    }
  }

  return {
    blockingIssues,
    canExecute,
    updateAlbum: (album: AlbumMetadata) =>
      update((api, id) => api.updateAlbum(id, album), t('notifications.updateAlbumFailed')),
    updateTrack: (trackId: string, track: TrackMetadata) =>
      update(
        (api, id) => api.updateTrack(id, trackId, track),
        t('notifications.updateTrackFailed'),
      ),
    setSaveCover: (enabled: boolean) =>
      update(
        (api, id) => api.setSaveCover(id, enabled),
        t('notifications.updateCoverOptionFailed'),
      ),
  }
}

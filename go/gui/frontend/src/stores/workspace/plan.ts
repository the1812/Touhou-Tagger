import { computed, type Ref } from 'vue'

import { getApi, type PlanPatch, type PlanPreview, type WorkspaceSummary } from '../../api'
import { t } from '../../i18n'
import { useNotificationsStore } from '../notifications'

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
  const canCommit = computed(
    () => Boolean(state.plan.value?.canCommit) && !state.stalePlan.value && !state.isBusy.value,
  )

  const updatePlan = async (patch: Omit<PlanPatch, 'planId' | 'revision'>) => {
    const current = state.plan.value
    if (!current || state.isBusy.value || state.stalePlan.value) {
      return false
    }
    state.activity.value = 'editing'
    try {
      const next = await (
        await getApi()
      ).updatePlan({
        planId: current.planId,
        revision: current.revision,
        ...patch,
      })
      state.plan.value = next
      state.stalePlan.value = false
      return true
    } catch (error) {
      let title = 'notifications.updateCoverOptionFailed'
      if (patch.album) {
        title = 'notifications.updateAlbumFailed'
      }
      if (patch.tracks) {
        title = 'notifications.updateTrackFailed'
      }
      notifications.error(t(title), error)
      return false
    } finally {
      state.activity.value = undefined
    }
  }

  return { blockingIssues, canCommit, updatePlan }
}

import { computed, type Ref } from 'vue'

import { useNotificationsStore } from '../../../entities/session'
import {
  getApi,
  type PlanPatch,
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

  const updatePlan = async (patch: Omit<PlanPatch, 'planId'>) => {
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
        ...patch,
      })
      state.plan.value = next
      state.stalePlan.value = false
      return true
    } catch (error) {
      const title = (() => {
        if (patch.tracks) {
          return 'notifications.updateTrackFailed'
        }
        if (patch.album) {
          return 'notifications.updateAlbumFailed'
        }
        return 'notifications.updateCoverOptionFailed'
      })()
      notifications.error(t(title), error)
      return false
    } finally {
      state.activity.value = undefined
    }
  }

  return { blockingIssues, canExecute, updatePlan }
}

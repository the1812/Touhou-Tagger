import { computed, ref, shallowRef, type Ref } from 'vue'

import { useNotificationsStore } from '../../../entities/session'
import {
  getApi,
  type AlbumCandidate,
  type PlanPreview,
  type WorkspaceSummary,
} from '../../../shared/api'
import { t } from '../../../shared/i18n'

export type WorkspaceActivity = 'selecting' | 'opening' | 'searching' | 'preparing' | 'editing'

export const useWorkspaceSearch = (state: {
  directory: Ref<string>
  summary: Ref<WorkspaceSummary | undefined>
  plan: Ref<PlanPreview | undefined>
  activity: Ref<WorkspaceActivity | undefined>
  isBusy: Readonly<Ref<boolean>>
  prepareFor(candidateId: string, source: string, opening: boolean): Promise<void>
}) => {
  const query = ref('')
  const source = ref('thb-wiki')
  const candidates = shallowRef<AlbumCandidate[]>()
  const selectedCandidateId = ref('')
  const notifications = useNotificationsStore()
  const canSearch = computed(
    () =>
      Boolean(state.summary.value?.audioCount && query.value.trim()) &&
      !state.isBusy.value &&
      !state.plan.value,
  )

  const clearSearch = () => {
    candidates.value = undefined
    selectedCandidateId.value = ''
  }
  const searchFor = async (opening: boolean) => {
    try {
      const found = await (
        await getApi()
      ).searchAlbums(state.directory.value, query.value.trim(), source.value)
      candidates.value = found
      const exact = found.length === 1 ? found[0] : found.find(candidate => candidate.exactMatch)
      selectedCandidateId.value = exact?.id ?? ''
      if (found.length === 1 && exact) {
        await state.prepareFor(exact.id, source.value, opening)
      }
    } catch (error) {
      notifications.error(t('notifications.searchAlbumsFailed'), error)
    }
  }
  const search = async () => {
    if (!canSearch.value) {
      return
    }
    state.activity.value = 'searching'
    try {
      await searchFor(false)
    } finally {
      state.activity.value = undefined
    }
  }
  const selectCandidate = (candidateId: string) => {
    if (!state.isBusy.value) {
      selectedCandidateId.value = candidateId
    }
  }
  const changeSource = (next: string) => {
    if (source.value !== next && !state.isBusy.value && !state.plan.value) {
      source.value = next
      clearSearch()
    }
  }

  return {
    query,
    source,
    candidates,
    selectedCandidateId,
    canSearch,
    searchFor,
    search,
    selectCandidate,
    changeSource,
    clearSearch,
  }
}

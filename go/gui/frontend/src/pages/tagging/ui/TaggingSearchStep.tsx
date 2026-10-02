import { Search } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import RadioButton from 'primevue/radiobutton'
import { computed, defineComponent } from 'vue'

import { useSettingsStore } from '../../../entities/session'
import { useWorkspaceStore } from '../../../features/workspace'
import { metadataSources } from '../../../shared/config'
import { sourceLabel, t } from '../../../shared/i18n'
import {
  CandidateCover,
  PageActionBar,
  SourceSelect,
  SourceWarning,
  TruncatedText,
  WorkspaceTitle,
} from '../../../shared/ui'
import { TaggingSearchSkeleton } from './TaggingSearchSkeleton'

export const TaggingSearchStep = defineComponent({
  name: 'TaggingSearchStep',
  setup() {
    const workspace = useWorkspaceStore()
    const settings = useSettingsStore()
    const {
      activity,
      summary,
      query,
      source,
      candidates,
      selectedCandidateId,
      plan,
      isBusy,
      canSearch,
      canPrepare,
    } = storeToRefs(workspace)
    const sourceOptions = computed(
      () =>
        settings.capabilities?.sources.filter(option => option.supportsSearch) ?? [
          { value: 'thb-wiki', label: sourceLabel('thb-wiki'), supportsSearch: true },
        ],
    )
    const showCover = computed(() => metadataSources[source.value]?.supportsSearchCover ?? false)

    return () => {
      const currentSummary = summary.value
      if (!currentSummary || currentSummary.hasMetadataJson || plan.value) {
        return null
      }

      return (
        <>
          <div class="workspace-section flex flex-1 flex-col">
            <div class="workspace-heading">
              <WorkspaceTitle>{t('tagging.searchAlbum')}</WorkspaceTitle>
            </div>
            <div
              class="mt-4 grid grid-cols-[12rem_minmax(12rem,1fr)_auto] gap-3"
              onKeydown={(event: KeyboardEvent) => {
                if (event.key === 'Enter' && !event.isComposing) {
                  event.preventDefault()
                  void workspace.search()
                }
              }}
            >
              <SourceSelect
                modelValue={source.value}
                {...{ 'onUpdate:modelValue': workspace.changeSource }}
                options={sourceOptions.value}
                disabled={isBusy.value}
              />
              <InputText
                id="album-search"
                v-model={query.value}
                placeholder={t('tagging.albumQueryPlaceholder')}
                autocomplete="off"
                fluid
                disabled={isBusy.value}
              />
              <Button
                label={t('common.search')}
                type="button"
                loading={activity.value === 'searching'}
                disabled={!canSearch.value}
                onClick={() => void workspace.search()}
              >
                {{ icon: () => <Search /> }}
              </Button>
            </div>
            <SourceWarning source={source.value} class="mt-1.5" />

            {activity.value === 'searching' && (
              <TaggingSearchSkeleton showCover={showCover.value} />
            )}
            {activity.value !== 'searching' && (candidates.value?.length ?? 0) > 0 && (
              <div class="mt-4 grid gap-0 border-t border-surface-200 dark:border-surface-700">
                {candidates.value?.map(candidate => (
                  <div
                    key={candidate.id}
                    class="candidate-option"
                    data-selected={selectedCandidateId.value === candidate.id}
                    data-cover={showCover.value}
                    onClick={() => workspace.selectCandidate(candidate.id)}
                  >
                    <RadioButton
                      name="album-candidate"
                      value={candidate.id}
                      modelValue={selectedCandidateId.value}
                      {...{
                        'onUpdate:modelValue': (value: string) => workspace.selectCandidate(value),
                        onClick: (event: MouseEvent) => event.stopPropagation(),
                      }}
                      disabled={isBusy.value}
                    />
                    {showCover.value && (
                      <CandidateCover
                        url={candidate.thumbnailUrl}
                        title={candidate.title}
                        class="size-16"
                      />
                    )}
                    <div class="min-w-0 flex-1">
                      <TruncatedText class="text-base font-medium">{candidate.title}</TruncatedText>
                      {candidate.artists.length > 0 && (
                        <TruncatedText class="text-sm text-muted-color">
                          {candidate.artists.join(' / ')}
                        </TruncatedText>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activity.value !== 'searching' && candidates.value?.length === 0 && (
              <div
                class={[
                  'mt-4 flex flex-1 flex-col items-center justify-center gap-3 border-t py-app-section-y text-center',
                  'border-surface-200 text-muted-color dark:border-surface-700',
                ]}
              >
                <Search class="size-[30px]" />
                <div class="font-medium">{t('tagging.noSearchResults')}</div>
              </div>
            )}
          </div>

          <PageActionBar end>
            <Button
              label={t('common.next')}
              disabled={!canPrepare.value}
              loading={activity.value === 'preparing'}
              onClick={() => void workspace.preparePlan()}
            />
          </PageActionBar>
        </>
      )
    }
  },
})

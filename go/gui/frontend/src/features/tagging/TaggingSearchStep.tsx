import { Search } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import { computed, defineComponent } from 'vue'

import { t } from '../../i18n'
import { PageActionBar } from '../../shared/PageActionBar'
import { TruncatedText } from '../../shared/TruncatedText'
import { WorkspaceTitle } from '../../shared/WorkspaceTitle'
import { useSettingsStore } from '../../stores/settings'
import { useWorkspaceStore } from '../../stores/workspace'

export const TaggingSearchStep = defineComponent({
  name: 'TaggingSearchStep',
  setup() {
    const workspace = useWorkspaceStore()
    const settings = useSettingsStore()
    const {
      phase,
      summary,
      query,
      source,
      candidates,
      hasSearched,
      selectedCandidateId,
      plan,
      operation,
      result,
      isBusy,
      canSearch,
      canPrepare,
    } = storeToRefs(workspace)
    const sourceOptions = computed(
      () =>
        settings.capabilities?.sources.filter(option => option.supportsSearch) ?? [
          { value: 'thb-wiki', label: 'THBWiki', supportsSearch: true },
        ],
    )
    const selectedSource = computed({
      get: () => source.value,
      set: (value: string) => workspace.changeSource(value),
    })

    return () => {
      const currentSummary = summary.value
      if (
        !currentSummary ||
        currentSummary.hasMetadataJson ||
        phase.value === 'failed' ||
        plan.value ||
        operation.value ||
        result.value
      ) {
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
                  workspace.search()
                }
              }}
            >
              <Select
                v-model={selectedSource.value}
                options={sourceOptions.value}
                optionLabel="label"
                optionValue="value"
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
                loading={phase.value === 'searching'}
                disabled={!canSearch.value}
                onClick={() => workspace.search()}
              >
                {{ icon: () => <Search /> }}
              </Button>
            </div>

            {phase.value === 'searching' ? (
              <div class="mt-4 grid gap-2">
                {[1, 2, 3].map(index => (
                  <Skeleton key={index} height="3.25rem" />
                ))}
              </div>
            ) : candidates.value.length ? (
              <div class="mt-4 grid gap-0 border-t border-surface-200 dark:border-surface-700">
                {candidates.value.map(candidate => (
                  <div
                    key={candidate.id}
                    class="candidate-option"
                    data-selected={selectedCandidateId.value === candidate.id}
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
                    <TruncatedText class="text-base font-medium">{candidate.title}</TruncatedText>
                  </div>
                ))}
              </div>
            ) : hasSearched.value ? (
              <div
                class={[
                  'mt-4 flex flex-1 flex-col items-center justify-center gap-3 border-t py-app-section-y text-center',
                  'border-surface-200 text-muted-color dark:border-surface-700',
                ]}
              >
                <Search class="size-[30px]" />
                <div class="font-medium">{t('tagging.noSearchResults')}</div>
              </div>
            ) : null}
          </div>

          {candidates.value.length > 0 && (
            <PageActionBar end>
              <Button
                label={t('common.next')}
                disabled={!canPrepare.value}
                loading={phase.value === 'preparing'}
                onClick={() => workspace.preparePlan()}
              />
            </PageActionBar>
          )}
        </>
      )
    }
  },
})

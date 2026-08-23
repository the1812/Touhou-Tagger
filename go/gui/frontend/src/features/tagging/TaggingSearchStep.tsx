import { Check, Search } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import { computed, defineComponent } from 'vue'

import { PageActionBar } from '../../shared/PageActionBar'
import { TruncatedText } from '../../shared/TruncatedText'
import { WorkspaceTitle } from '../../shared/WorkspaceTitle'
import { t } from '../../i18n'
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
          <section class="workspace-section border-b-0">
            <div class="workspace-heading">
              <WorkspaceTitle>{t('tagging.searchAlbum')}</WorkspaceTitle>
            </div>
            <form
              class="mt-4 grid grid-cols-[12rem_minmax(12rem,1fr)_auto] gap-3"
              onSubmit={event => {
                event.preventDefault()
                workspace.search()
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
                type="submit"
                loading={phase.value === 'searching'}
                disabled={!canSearch.value}
              >
                {{ icon: () => <Search size={17} /> }}
              </Button>
            </form>

            {phase.value === 'searching' ? (
              <div class="mt-4 grid gap-2">
                {[1, 2, 3].map(index => (
                  <Skeleton key={index} height="3.25rem" />
                ))}
              </div>
            ) : candidates.value.length ? (
              <div class="mt-4 grid gap-0 border-t border-surface-200 dark:border-surface-700">
                {candidates.value.map(candidate => (
                  <button
                    key={candidate.id}
                    type="button"
                    class="candidate-option"
                    data-selected={selectedCandidateId.value === candidate.id}
                    disabled={isBusy.value}
                    onClick={() => workspace.selectCandidate(candidate.id)}
                  >
                    <span
                      class={[
                        'grid size-5 place-items-center rounded-full border border-surface-300 text-white dark:border-surface-600',
                        {
                          'border-primary bg-primary': selectedCandidateId.value === candidate.id,
                        },
                      ]}
                    >
                      {selectedCandidateId.value === candidate.id && <Check size={15} />}
                    </span>
                    <TruncatedText as="strong" class="text-sm">
                      {candidate.title}
                    </TruncatedText>
                  </button>
                ))}
              </div>
            ) : hasSearched.value ? (
              <div
                class={[
                  'mt-4 grid place-items-center gap-1.5 border-y py-app-section-y text-center',
                  'border-surface-200 text-muted-color dark:border-surface-700',
                ]}
              >
                <Search size={30} />
                <strong>{t('tagging.noSearchResults')}</strong>
              </div>
            ) : null}
          </section>

          {candidates.value.length > 0 && (
            <PageActionBar end>
              <Button
                label={t('common.next')}
                size="large"
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

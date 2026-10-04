import { Ban, Play } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { defineComponent } from 'vue'
import { Translation } from 'vue-i18n'

import { useBatchStore } from '../../../features/batch'
import { t } from '../../../shared/i18n'
import { usePageCommands, useDelayedBusy } from '../../../shared/lib'
import { PageActionBar } from '../../../shared/ui'
import { BatchDirectoryHeader } from './BatchDirectoryHeader'
import { BatchDirectoryPicker } from './BatchDirectoryPicker'
import { BatchEntriesSection } from './BatchEntriesSection'

export const BatchPage = defineComponent({
  name: 'BatchPage',
  setup() {
    const batch = useBatchStore()
    const {
      mode,
      choosingMode,
      directory,
      preview,
      scanning,
      operation,
      isWriting,
      readyCount,
      skippedCount,
      canRun,
    } = storeToRefs(batch)

    const showSpinner = useDelayedBusy(() => isWriting.value)
    usePageCommands({
      openDirectory: directories => batch.openDirectories(directories),
      refresh: () => {
        if (choosingMode.value || !preview.value) {
          return false
        }
        void batch.refresh()
        return true
      },
    })

    return () => {
      const hasInput =
        mode.value === 'directoryScan' ? Boolean(directory.value) : Boolean(preview.value)
      const currentPreview = preview.value
      const currentOperation = operation.value

      return (
        <div class="workspace-sections round-icon-buttons grid min-h-full content-start gap-0">
          {choosingMode.value || !hasInput ? (
            <BatchDirectoryPicker />
          ) : (
            <>
              {mode.value === 'directoryScan' && <BatchDirectoryHeader />}

              <>
                <BatchEntriesSection />

                {!scanning.value && (
                  <PageActionBar
                    v-slots={{
                      status: () => (
                        <div class="flex flex-wrap items-center gap-3">
                          <div>
                            {currentPreview && (
                              <Translation
                                keypath="batch.albumCount"
                                scope="global"
                                v-slots={{
                                  count: () => (
                                    <div class="inline text-color">
                                      {currentPreview.entries.length}
                                    </div>
                                  ),
                                }}
                              />
                            )}
                            {skippedCount.value > 0 && (
                              <div class="inline">
                                {t('batch.writeSelection', {
                                  ready: readyCount.value,
                                  skipped: skippedCount.value,
                                })}
                              </div>
                            )}
                          </div>
                          {isWriting.value && (
                            <div class="flex items-center gap-2 text-sm text-muted-color">
                              <ProgressSpinner
                                class={['size-4! m-0!', { invisible: !showSpinner.value }]}
                                strokeWidth="4"
                              />
                              <div>
                                {t('operation.writing')}
                                {currentOperation && (
                                  <div class="inline tabular-nums">
                                    {' '}
                                    · {currentOperation.current} / {currentOperation.total}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ),
                      secondaryAction: () => (
                        <Button
                          label={t('common.previous')}
                          severity="secondary"
                          text
                          disabled={!batch.canSwitchMode}
                          onClick={batch.backToSelection}
                        />
                      ),
                      action: () =>
                        isWriting.value ? (
                          <Button
                            label={t('operation.cancel')}
                            class="min-w-28"
                            severity="secondary"
                            text
                            disabled={!currentOperation?.cancellable}
                            onClick={() => void batch.cancel()}
                          >
                            {{ icon: () => <Ban /> }}
                          </Button>
                        ) : (
                          <Button
                            label={t('common.start')}
                            class="min-w-28"
                            disabled={!canRun.value}
                            onClick={() => void batch.run(false)}
                          >
                            {{ icon: () => <Play /> }}
                          </Button>
                        ),
                    }}
                  />
                )}
              </>
            </>
          )}
        </div>
      )
    }
  },
})

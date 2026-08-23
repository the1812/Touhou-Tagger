import { Info, RotateCcw } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { computed, defineComponent, onMounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

import { useSettingsStore } from '../../stores/settings'
import { t } from '../../i18n'

const fieldClass =
  'grid content-start gap-1.5 text-[.8rem] font-semibold text-color [&>small]:font-normal [&>small]:leading-[1.4] [&>small]:text-muted-color'
const sectionClass =
  'grid gap-4 border-b border-surface-200 py-5 last:border-b-0 dark:border-surface-700 [&>h2]:m-0 [&>h2]:text-base [&>h2]:font-bold'
const gridClass = 'grid grid-cols-2 gap-x-4 gap-y-3.5 max-[980px]:grid-cols-1'

export const SettingsPage = defineComponent({
  name: 'SettingsPage',
  setup() {
    const settingsStore = useSettingsStore()
    const { draft, capabilities, loading, saving, dirty, errors, valid } =
      storeToRefs(settingsStore)
    const confirm = useConfirm()
    const searchableSources = computed(() =>
      capabilities.value?.sources.filter(option => option.supportsSearch),
    )
    const lyricDestinations = [
      { label: t('settings.lyricDestination.none'), value: 'none' },
      { label: t('settings.lyricDestination.metadata'), value: 'metadata' },
      { label: t('settings.lyricDestination.lrc'), value: 'lrc' },
    ]
    const lyricDestination = computed({
      get: () => {
        if (!draft.value?.writeLyricsMetadata && !draft.value?.writeLrcFiles) {
          return 'none'
        }
        return draft.value.writeLrcFiles ? 'lrc' : 'metadata'
      },
      set: (value: string) => {
        if (!draft.value) {
          return
        }
        draft.value.writeLyricsMetadata = value === 'metadata'
        draft.value.writeLrcFiles = value === 'lrc'
      },
    })

    onMounted(() => settingsStore.load())

    onBeforeRouteLeave(async () => {
      if (!dirty.value) {
        return true
      }

      if (valid.value && (await settingsStore.flush())) {
        return true
      }

      return new Promise<boolean>(resolve => {
        confirm.require({
          group: 'settings-leave',
          header: t('settings.discardChanges.header'),
          message: t('settings.discardChanges.message'),
          acceptLabel: t('settings.discardChanges.accept'),
          rejectLabel: t('settings.discardChanges.reject'),
          accept: () => {
            settingsStore.discard()
            resolve(true)
          },
          reject: () => resolve(false),
        })
      })
    })

    const confirmReset = () => {
      confirm.require({
        group: 'settings-reset',
        header: t('settings.reset.header'),
        message: t('settings.reset.message'),
        acceptLabel: t('settings.reset.accept'),
        rejectLabel: t('common.cancel'),
        accept: settingsStore.reset,
      })
    }

    return () => {
      const currentDraft = draft.value
      return (
        <div class="-mx-6 -my-5 h-[calc(100%+2.5rem)] min-h-0">
          {loading.value || !currentDraft ? (
            <div class="grid gap-4 px-6 py-5">
              <Skeleton height="10rem" />
              <Skeleton height="8rem" />
              <Skeleton height="12rem" />
            </div>
          ) : (
            <div class="h-full min-h-0 overflow-auto">
              <div class="px-6">
                <section class={sectionClass}>
                  <h2>{t('settings.general')}</h2>
                  <div class={gridClass}>
                    <label class={fieldClass}>
                      <span>{t('settings.defaultSource')}</span>
                      <Select
                        v-model={currentDraft.defaultSource}
                        options={searchableSources.value}
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        fluid
                      />
                      {errors.value.defaultSource && (
                        <small class="text-red-700! dark:text-red-300!">
                          {errors.value.defaultSource}
                        </small>
                      )}
                    </label>
                    <label class={fieldClass}>
                      <span>{t('settings.commentLanguage')}</span>
                      <Select
                        v-model={currentDraft.commentLanguage}
                        options={capabilities.value?.commentLanguages}
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        fluid
                      />
                    </label>
                    <label class={`${fieldClass} col-span-full max-[980px]:col-auto`}>
                      <span>{t('settings.mp3Separator')}</span>
                      <InputText
                        v-model={currentDraft.mp3MultiValueSeparator}
                        invalid={Boolean(errors.value.mp3MultiValueSeparator)}
                        size="small"
                        fluid
                      />
                      {errors.value.mp3MultiValueSeparator ? (
                        <small class="text-red-700! dark:text-red-300!">
                          {errors.value.mp3MultiValueSeparator}
                        </small>
                      ) : (
                        <small>{t('settings.mp3SeparatorHelp')}</small>
                      )}
                    </label>
                    <label class={fieldClass}>
                      <span>{t('settings.requestTimeout')}</span>
                      <InputNumber
                        v-model={currentDraft.requestTimeoutSeconds}
                        min={1}
                        max={300}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.requestTimeoutSeconds)}
                      />
                      {errors.value.requestTimeoutSeconds && (
                        <small class="text-red-700! dark:text-red-300!">
                          {errors.value.requestTimeoutSeconds}
                        </small>
                      )}
                    </label>
                    <label class={fieldClass}>
                      <span>{t('settings.retryCount')}</span>
                      <InputNumber
                        v-model={currentDraft.retryCount}
                        min={1}
                        max={10}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.retryCount)}
                      />
                      {errors.value.retryCount && (
                        <small class="text-red-700! dark:text-red-300!">
                          {errors.value.retryCount}
                        </small>
                      )}
                    </label>
                  </div>
                </section>

                <section class={sectionClass}>
                  <h2>{t('settings.cover')}</h2>
                  <div class={gridClass}>
                    <label class={fieldClass}>
                      <span class="flex items-center gap-1">
                        {t('settings.coverThreshold')}
                        <button
                          type="button"
                          class="help-icon"
                          v-tooltip={{ value: t('settings.coverThresholdHelp') }}
                        >
                          <Info size={13} />
                        </button>
                      </span>
                      <InputNumber
                        v-model={currentDraft.coverCompressionThresholdKb}
                        min={0}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.coverCompressionThresholdKb)}
                      />
                      {errors.value.coverCompressionThresholdKb && (
                        <small class="text-red-700! dark:text-red-300!">
                          {errors.value.coverCompressionThresholdKb}
                        </small>
                      )}
                    </label>
                    <label class={fieldClass}>
                      <span class="flex items-center gap-1">
                        {t('settings.coverMaxEdge')}
                        <button
                          type="button"
                          class="help-icon"
                          v-tooltip={{ value: t('settings.coverMaxEdgeHelp') }}
                        >
                          <Info size={13} />
                        </button>
                      </span>
                      <InputNumber
                        v-model={currentDraft.coverMaxEdge}
                        min={0}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.coverMaxEdge)}
                      />
                      {errors.value.coverMaxEdge && (
                        <small class="text-red-700! dark:text-red-300!">
                          {errors.value.coverMaxEdge}
                        </small>
                      )}
                    </label>
                  </div>
                </section>

                <section class={sectionClass}>
                  <h2>{t('settings.lyrics')}</h2>
                  <div class={gridClass}>
                    <label class={fieldClass}>
                      <span>{t('settings.outputDestination')}</span>
                      <Select
                        v-model={lyricDestination.value}
                        options={lyricDestinations}
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        fluid
                      />
                      {errors.value.lyricDestination && (
                        <small class="text-red-700! dark:text-red-300!">
                          {errors.value.lyricDestination}
                        </small>
                      )}
                    </label>
                    <label class={fieldClass}>
                      <span>{t('settings.lyricType')}</span>
                      <Select
                        v-model={currentDraft.lyricType}
                        options={capabilities.value?.lyricTypes}
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        fluid
                        disabled={lyricDestination.value === 'none'}
                      />
                    </label>
                    <label class={`${fieldClass} col-span-full max-[980px]:col-auto`}>
                      <span>{t('settings.mixedLyricSeparator')}</span>
                      <InputText
                        v-model={currentDraft.mixedLyricSeparator}
                        size="small"
                        fluid
                        disabled={lyricDestination.value === 'none'}
                        invalid={Boolean(errors.value.mixedLyricSeparator)}
                      />
                      {errors.value.mixedLyricSeparator && (
                        <small class="text-red-700! dark:text-red-300!">
                          {errors.value.mixedLyricSeparator}
                        </small>
                      )}
                    </label>
                    <label class="flex min-w-0 items-center justify-between gap-4 text-[.8rem]">
                      <span class="grid gap-1">
                        <strong>{t('settings.preserveTimeline')}</strong>
                        <small class="font-normal text-muted-color">
                          {t('settings.preserveTimelineHelp')}
                        </small>
                      </span>
                      <ToggleSwitch
                        v-model={currentDraft.preserveLyricTimeline}
                        disabled={lyricDestination.value === 'none'}
                      />
                    </label>
                    <label class={fieldClass}>
                      <span>{t('settings.lyricCacheSize')}</span>
                      <InputNumber
                        v-model={currentDraft.lyricCacheSize}
                        min={1}
                        max={10000}
                        showButtons
                        size="small"
                        fluid
                        disabled={lyricDestination.value === 'none'}
                        invalid={Boolean(errors.value.lyricCacheSize)}
                      />
                      {errors.value.lyricCacheSize && (
                        <small class="text-red-700! dark:text-red-300!">
                          {errors.value.lyricCacheSize}
                        </small>
                      )}
                    </label>
                  </div>
                </section>
              </div>

              <div class="flex items-center justify-center border-t border-surface-200 px-6 pb-6 pt-4 dark:border-surface-700">
                <Button
                  label={t('settings.reset.accept')}
                  type="button"
                  size="small"
                  severity="secondary"
                  text
                  disabled={saving.value}
                  onClick={confirmReset}
                >
                  {{ icon: () => <RotateCcw size={15} /> }}
                </Button>
              </div>
            </div>
          )}

          <ConfirmDialog group="settings-leave" />
          <ConfirmDialog group="settings-reset" />
        </div>
      )
    }
  },
})

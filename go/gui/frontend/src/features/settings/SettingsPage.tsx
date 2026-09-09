import { RotateCcw } from 'lucide-vue-next'
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

import { t } from '../../i18n'
import { FieldLabel, FormField } from '../../shared/FormField'
import { FormSection } from '../../shared/FormSection'
import { useSettingsStore } from '../../stores/settings'

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
          rejectProps: { severity: 'secondary', text: true },
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
        rejectProps: { severity: 'secondary', text: true },
        accept: settingsStore.reset,
      })
    }

    return () => {
      const currentDraft = draft.value
      return (
        <div class="h-full min-h-0">
          {loading.value || !currentDraft ? (
            <div
              class={['grid h-full w-full max-w-app-settings gap-4', 'px-app-page-x py-app-page-y']}
            >
              <Skeleton height="10rem" />
              <Skeleton height="8rem" />
              <Skeleton height="12rem" />
            </div>
          ) : (
            <div class="app-scrollbar h-full min-h-0 overflow-auto">
              <div class="w-full max-w-app-settings px-app-page-x">
                <FormSection title={t('settings.general')}>
                  <div class="grid justify-items-start gap-y-3.5">
                    <FormField variant="settings" error={errors.value.defaultSource}>
                      <FieldLabel help={t('settings.defaultSourceHelp')}>
                        {t('settings.defaultSource')}
                      </FieldLabel>
                      <Select
                        v-model={currentDraft.defaultSource}
                        options={searchableSources.value}
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        fluid
                      />
                    </FormField>
                    <FormField variant="settings">
                      <FieldLabel help={t('settings.commentLanguageHelp')}>
                        {t('settings.commentLanguage')}
                      </FieldLabel>
                      <Select
                        v-model={currentDraft.commentLanguage}
                        options={capabilities.value?.commentLanguages}
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        fluid
                      />
                    </FormField>
                    <FormField variant="settings" error={errors.value.mp3MultiValueSeparator}>
                      <FieldLabel help={t('settings.mp3SeparatorHelp')}>
                        {t('settings.mp3Separator')}
                      </FieldLabel>
                      <InputText
                        v-model={currentDraft.mp3MultiValueSeparator}
                        invalid={Boolean(errors.value.mp3MultiValueSeparator)}
                        size="small"
                        fluid
                      />
                    </FormField>
                    <FormField variant="settings" error={errors.value.requestTimeoutSeconds}>
                      <FieldLabel help={t('settings.requestTimeoutHelp')}>
                        {t('settings.requestTimeout')}
                      </FieldLabel>
                      <InputNumber
                        useGrouping={false}
                        v-model={currentDraft.requestTimeoutSeconds}
                        min={1}
                        max={300}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.requestTimeoutSeconds)}
                      />
                    </FormField>
                    <FormField variant="settings" error={errors.value.retryCount}>
                      <FieldLabel help={t('settings.retryCountHelp')}>
                        {t('settings.retryCount')}
                      </FieldLabel>
                      <InputNumber
                        useGrouping={false}
                        v-model={currentDraft.retryCount}
                        min={1}
                        max={10}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.retryCount)}
                      />
                    </FormField>
                  </div>
                </FormSection>

                <FormSection title={t('settings.cover')}>
                  <div class="grid justify-items-start gap-y-3.5">
                    <FormField variant="settings" error={errors.value.coverCompressionThresholdKb}>
                      <FieldLabel help={t('settings.coverThresholdHelp')}>
                        {t('settings.coverThreshold')}
                      </FieldLabel>
                      <InputNumber
                        useGrouping={false}
                        v-model={currentDraft.coverCompressionThresholdKb}
                        min={0}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.coverCompressionThresholdKb)}
                      />
                    </FormField>
                    <FormField variant="settings" error={errors.value.coverMaxEdge}>
                      <FieldLabel help={t('settings.coverMaxEdgeHelp')}>
                        {t('settings.coverMaxEdge')}
                      </FieldLabel>
                      <InputNumber
                        useGrouping={false}
                        v-model={currentDraft.coverMaxEdge}
                        min={0}
                        showButtons
                        size="small"
                        fluid
                        invalid={Boolean(errors.value.coverMaxEdge)}
                      />
                    </FormField>
                  </div>
                </FormSection>

                <FormSection title={t('settings.lyrics')}>
                  <div class="grid justify-items-start gap-y-3.5">
                    <FormField variant="settings" error={errors.value.lyricDestination}>
                      <FieldLabel help={t('settings.outputDestinationHelp')}>
                        {t('settings.outputDestination')}
                      </FieldLabel>
                      <Select
                        v-model={lyricDestination.value}
                        options={lyricDestinations}
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        fluid
                      />
                    </FormField>
                    <FormField variant="settings">
                      <FieldLabel help={t('settings.lyricTypeHelp')}>
                        {t('settings.lyricType')}
                      </FieldLabel>
                      <Select
                        v-model={currentDraft.lyricType}
                        options={capabilities.value?.lyricTypes}
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        fluid
                        disabled={lyricDestination.value === 'none'}
                      />
                    </FormField>
                    <FormField variant="settings" error={errors.value.mixedLyricSeparator}>
                      <FieldLabel help={t('settings.mixedLyricSeparatorHelp')}>
                        {t('settings.mixedLyricSeparator')}
                      </FieldLabel>
                      <InputText
                        v-model={currentDraft.mixedLyricSeparator}
                        size="small"
                        fluid
                        disabled={lyricDestination.value === 'none'}
                        invalid={Boolean(errors.value.mixedLyricSeparator)}
                      />
                    </FormField>
                    <FormField variant="settings" class="min-w-0 justify-items-start">
                      <FieldLabel emphasis={false} help={t('settings.preserveTimelineHelp')}>
                        {t('settings.preserveTimeline')}
                      </FieldLabel>
                      <ToggleSwitch
                        v-model={currentDraft.preserveLyricTimeline}
                        disabled={lyricDestination.value === 'none'}
                      />
                    </FormField>
                    <FormField variant="settings" error={errors.value.lyricCacheSize}>
                      <FieldLabel help={t('settings.lyricCacheSizeHelp')}>
                        {t('settings.lyricCacheSize')}
                      </FieldLabel>
                      <InputNumber
                        useGrouping={false}
                        v-model={currentDraft.lyricCacheSize}
                        min={1}
                        max={10000}
                        showButtons
                        size="small"
                        fluid
                        disabled={lyricDestination.value === 'none'}
                        invalid={Boolean(errors.value.lyricCacheSize)}
                      />
                    </FormField>
                  </div>
                </FormSection>
              </div>

              <div
                class={[
                  'flex w-full items-center justify-start border-t py-4',
                  'border-surface-200 px-app-page-x dark:border-surface-700',
                ]}
              >
                <Button
                  label={t('settings.reset.trigger')}
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  disabled={saving.value}
                  onClick={confirmReset}
                >
                  {{ icon: () => <RotateCcw /> }}
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

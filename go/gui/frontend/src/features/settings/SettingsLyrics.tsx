import { storeToRefs } from 'pinia'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, defineComponent } from 'vue'

import { t } from '../../i18n'
import { FieldLabel } from '../../shared/FieldLabel'
import { FormField } from '../../shared/FormField'
import { FormSection } from '../../shared/FormSection'
import { useSettingsStore } from '../../stores/settings'

export const SettingsLyrics = defineComponent({
  name: 'SettingsLyrics',
  setup() {
    const { draft, capabilities, errors } = storeToRefs(useSettingsStore())
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

    return () => {
      const currentDraft = draft.value
      if (!currentDraft) {
        return null
      }
      return (
        <FormSection title={t('settings.lyrics')}>
          <div class="grid justify-items-start gap-y-3.5">
            <FormField variant="settings" error={errors.value.lyricDestination}>
              <FieldLabel
                for="settings-outputDestination"
                help={t('settings.outputDestinationHelp')}
              >
                {t('settings.outputDestination')}
              </FieldLabel>
              <Select
                labelId="settings-outputDestination"
                v-model={lyricDestination.value}
                options={lyricDestinations}
                optionLabel="label"
                optionValue="value"
                size="small"
                fluid
              />
            </FormField>
            <FormField variant="settings">
              <FieldLabel for="settings-lyricType" help={t('settings.lyricTypeHelp')}>
                {t('settings.lyricType')}
              </FieldLabel>
              <Select
                labelId="settings-lyricType"
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
              <FieldLabel
                for="settings-mixedLyricSeparator"
                help={t('settings.mixedLyricSeparatorHelp')}
              >
                {t('settings.mixedLyricSeparator')}
              </FieldLabel>
              <InputText
                id="settings-mixedLyricSeparator"
                v-model={currentDraft.mixedLyricSeparator}
                size="small"
                fluid
                disabled={lyricDestination.value === 'none'}
                invalid={Boolean(errors.value.mixedLyricSeparator)}
              />
            </FormField>
            <FormField variant="settings" class="min-w-0 justify-items-start">
              <FieldLabel
                for="settings-preserveTimeline"
                emphasis={false}
                help={t('settings.preserveTimelineHelp')}
              >
                {t('settings.preserveTimeline')}
              </FieldLabel>
              <ToggleSwitch
                inputId="settings-preserveTimeline"
                v-model={currentDraft.preserveLyricTimeline}
                disabled={lyricDestination.value === 'none'}
              />
            </FormField>
            <FormField variant="settings" error={errors.value.lyricCacheSize}>
              <FieldLabel for="settings-lyricCacheSize" help={t('settings.lyricCacheSizeHelp')}>
                {t('settings.lyricCacheSize')}
              </FieldLabel>
              <InputNumber
                inputId="settings-lyricCacheSize"
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
      )
    }
  },
})

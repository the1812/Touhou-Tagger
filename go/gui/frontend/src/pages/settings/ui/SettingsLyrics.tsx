import { storeToRefs } from 'pinia'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, defineComponent } from 'vue'

import { useSettingsStore } from '../../../entities/session'
import { LyricOutput } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { FieldLabel, FormField, FormSection } from '../../../shared/ui'

export const SettingsLyrics = defineComponent({
  name: 'SettingsLyrics',
  setup() {
    const { draft, capabilities, errors } = storeToRefs(useSettingsStore())
    const lyricDestinations = [
      { label: t('settings.lyricDestination.none'), value: 'none' },
      { label: t('settings.lyricDestination.metadata'), value: LyricOutput.LyricMetadata },
      { label: t('settings.lyricDestination.lrc'), value: LyricOutput.LyricLRC },
    ]
    const lyricDestination = computed({
      get: () => {
        if (!draft.value?.lyricEnabled) {
          return 'none'
        }
        return draft.value.lyric.output
      },
      set: (value: 'none' | LyricOutput) => {
        if (!draft.value) {
          return
        }
        draft.value.lyricEnabled = value !== 'none'
        if (value !== 'none') {
          draft.value.lyric.output = value
        }
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
            <FormField variant="settings">
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
                v-model={currentDraft.lyric.type}
                options={capabilities.value?.lyricTypes}
                optionLabel="label"
                optionValue="value"
                size="small"
                fluid
                disabled={lyricDestination.value === 'none'}
              />
            </FormField>
            <FormField variant="settings" error={errors.value['lyric.translationSeparator']}>
              <FieldLabel
                for="settings-mixedLyricSeparator"
                help={t('settings.mixedLyricSeparatorHelp')}
              >
                {t('settings.mixedLyricSeparator')}
              </FieldLabel>
              <InputText
                id="settings-mixedLyricSeparator"
                v-model={currentDraft.lyric.translationSeparator}
                size="small"
                fluid
                disabled={lyricDestination.value === 'none'}
                invalid={Boolean(errors.value['lyric.translationSeparator'])}
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
                v-model={currentDraft.lyric.time}
                disabled={lyricDestination.value === 'none'}
              />
            </FormField>
            <FormField variant="settings" error={errors.value['lyric.maxCacheSize']}>
              <FieldLabel for="settings-lyricCacheSize" help={t('settings.lyricCacheSizeHelp')}>
                {t('settings.lyricCacheSize')}
              </FieldLabel>
              <InputNumber
                inputId="settings-lyricCacheSize"
                useGrouping={false}
                v-model={currentDraft.lyric.maxCacheSize}
                min={1}
                max={10000}
                showButtons
                size="small"
                fluid
                disabled={lyricDestination.value === 'none'}
                invalid={Boolean(errors.value['lyric.maxCacheSize'])}
              />
            </FormField>
          </div>
        </FormSection>
      )
    }
  },
})

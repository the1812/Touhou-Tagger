import { storeToRefs } from 'pinia'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, defineComponent } from 'vue'

import { useSettingsStore } from '../../../entities/session'
import { t } from '../../../shared/i18n'
import { FieldLabel, FormField, FormSection, SourceSelect, SourceWarning } from '../../../shared/ui'

export const SettingsGeneral = defineComponent({
  name: 'SettingsGeneral',
  setup() {
    const { draft, capabilities, errors } = storeToRefs(useSettingsStore())
    const searchableSources = computed(() =>
      capabilities.value?.sources.filter(option => option.supportsSearch),
    )
    return () => {
      const currentDraft = draft.value
      if (!currentDraft) {
        return null
      }
      return (
        <FormSection title={t('settings.general')}>
          <div class="grid justify-items-start gap-y-3.5">
            <FormField variant="settings" error={errors.value.defaultSource}>
              <FieldLabel for="settings-defaultSource" help={t('settings.defaultSourceHelp')}>
                {t('settings.defaultSource')}
              </FieldLabel>
              <SourceSelect
                labelId="settings-defaultSource"
                modelValue={currentDraft.defaultSource}
                {...{
                  'onUpdate:modelValue': (value: string) => (currentDraft.defaultSource = value),
                }}
                options={searchableSources.value}
                size="small"
                fluid
              />
              <SourceWarning source={currentDraft.defaultSource} />
            </FormField>
            <FormField variant="settings">
              <FieldLabel for="settings-commentLanguage" help={t('settings.commentLanguageHelp')}>
                {t('settings.commentLanguage')}
              </FieldLabel>
              <Select
                labelId="settings-commentLanguage"
                v-model={currentDraft.commentLanguage}
                options={capabilities.value?.commentLanguages}
                optionLabel="label"
                optionValue="value"
                size="small"
                fluid
              />
            </FormField>
            <FormField variant="settings" error={errors.value.mp3MultiValueSeparator}>
              <FieldLabel for="settings-mp3Separator" help={t('settings.mp3SeparatorHelp')}>
                {t('settings.mp3Separator')}
              </FieldLabel>
              <InputText
                id="settings-mp3Separator"
                v-model={currentDraft.mp3MultiValueSeparator}
                invalid={Boolean(errors.value.mp3MultiValueSeparator)}
                size="small"
                fluid
              />
            </FormField>
            <FormField variant="settings" error={errors.value.requestTimeoutSeconds}>
              <FieldLabel for="settings-requestTimeout" help={t('settings.requestTimeoutHelp')}>
                {t('settings.requestTimeout')}
              </FieldLabel>
              <InputNumber
                inputId="settings-requestTimeout"
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
              <FieldLabel for="settings-retryCount" help={t('settings.retryCountHelp')}>
                {t('settings.retryCount')}
              </FieldLabel>
              <InputNumber
                inputId="settings-retryCount"
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
      )
    }
  },
})

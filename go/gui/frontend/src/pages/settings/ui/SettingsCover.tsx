import { storeToRefs } from 'pinia'
import InputNumber from 'primevue/inputnumber'
import { defineComponent } from 'vue'

import { useSettingsStore } from '../../../entities/session'
import { t } from '../../../shared/i18n'
import { FieldLabel, FormField, FormSection } from '../../../shared/ui'

export const SettingsCover = defineComponent({
  name: 'SettingsCover',
  setup() {
    const { draft, errors } = storeToRefs(useSettingsStore())
    return () => {
      const currentDraft = draft.value
      if (!currentDraft) {
        return null
      }
      return (
        <FormSection title={t('settings.cover')}>
          <div class="grid justify-items-start gap-y-3.5">
            <FormField variant="settings" error={errors.value.coverCompressSize}>
              <FieldLabel for="settings-coverThreshold" help={t('settings.coverThresholdHelp')}>
                {t('settings.coverThreshold')}
              </FieldLabel>
              <InputNumber
                inputId="settings-coverThreshold"
                useGrouping={false}
                modelValue={currentDraft.coverCompressSize * 1024}
                {...{
                  'onUpdate:modelValue': (value: number | null) => {
                    currentDraft.coverCompressSize = (value ?? 0) / 1024
                  },
                }}
                min={0}
                showButtons
                size="small"
                fluid
                invalid={Boolean(errors.value.coverCompressSize)}
              />
            </FormField>
            <FormField variant="settings" error={errors.value.coverCompressResolution}>
              <FieldLabel for="settings-coverMaxEdge" help={t('settings.coverMaxEdgeHelp')}>
                {t('settings.coverMaxEdge')}
              </FieldLabel>
              <InputNumber
                inputId="settings-coverMaxEdge"
                useGrouping={false}
                v-model={currentDraft.coverCompressResolution}
                min={0}
                showButtons
                size="small"
                fluid
                invalid={Boolean(errors.value.coverCompressResolution)}
              />
            </FormField>
          </div>
        </FormSection>
      )
    }
  },
})

import { RotateCcw } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import { defineComponent, onMounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

import { useSettingsStore } from '../../../entities/session'
import { t } from '../../../shared/i18n'
import { SettingsCover } from './SettingsCover'
import { SettingsGeneral } from './SettingsGeneral'
import { SettingsLyrics } from './SettingsLyrics'
import { SettingsPageSkeleton } from './SettingsPageSkeleton'

export const SettingsPage = defineComponent({
  name: 'SettingsPage',
  setup() {
    const settingsStore = useSettingsStore()
    const { draft, loading, saving, dirty, valid } = storeToRefs(settingsStore)
    const confirm = useConfirm()
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
        accept: () => void settingsStore.reset(),
      })
    }

    return () => {
      const currentDraft = draft.value
      return (
        <div class="h-full min-h-0">
          {loading.value || !currentDraft ? (
            <SettingsPageSkeleton />
          ) : (
            <div class="h-full min-h-0 overflow-auto">
              <div class="w-full max-w-app-settings px-app-page-x">
                <SettingsGeneral />
                <SettingsCover />
                <SettingsLyrics />
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

import { onBeforeUnmount, onMounted } from 'vue'

import { getApi, isFixtureMode } from '../api'
import { t } from '../i18n'
import { useNotificationsStore } from '../stores/notifications'
import { useOperationsStore } from '../stores/operations'
import { useSettingsStore } from '../stores/settings'
import { useWorkspaceStore } from '../stores/workspace'

export const useAppRuntime = () => {
  const notifications = useNotificationsStore()
  const operations = useOperationsStore()
  const settings = useSettingsStore()
  const workspace = useWorkspaceStore()
  const disposers: Array<() => void> = []

  onMounted(async () => {
    const api = await getApi()
    disposers.push(
      api.onProgress(operations.receiveProgress),
      api.onComplete(operations.receiveComplete),
      api.onFailure(operations.receiveFailure),
      api.onProcessError(error => {
        notifications.error(t('operation.incomplete'), error.message, {
          diagnostics: error.details,
        })
      }),
    )
    await settings.load()
    if (!isFixtureMode) {
      await workspace.loadStartupDirectory()
    }
  })

  onBeforeUnmount(() => disposers.forEach(dispose => dispose()))
}

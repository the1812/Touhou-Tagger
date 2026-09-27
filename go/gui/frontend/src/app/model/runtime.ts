import { onBeforeUnmount, onMounted } from 'vue'

import { useNotificationsStore, useOperationsStore, useSettingsStore } from '../../entities/session'
import { useWorkspaceStore } from '../../features/workspace'
import { getApi, isFixtureMode } from '../../shared/api'
import { t } from '../../shared/i18n'

export const useAppRuntime = () => {
  const operations = useOperationsStore()
  const settings = useSettingsStore()
  const workspace = useWorkspaceStore()
  const notifications = useNotificationsStore()
  const disposers: Array<() => void> = []

  onMounted(async () => {
    const api = await getApi()
    disposers.push(
      api.onProgress(operations.receiveProgress),
      api.onComplete(operations.receiveComplete),
      api.onFailure(operations.receiveFailure),
    )
    await settings.load()
    if (
      import.meta.env.DEV &&
      isFixtureMode &&
      ['workspace', 'batch'].includes(
        new URLSearchParams(window.location.search).get('progress') ?? '',
      )
    ) {
      const { initializeProgressMock } = await import('../layout/ProgressPanel')
      await initializeProgressMock()
    }
    if (!isFixtureMode) {
      try {
        const directory = await api.getStartupDirectory()
        if (directory && !workspace.directory) {
          await workspace.scan(directory)
        }
      } catch (error) {
        notifications.error(t('notifications.loadStartupDirectoryFailed'), error)
      }
    }
  })

  onBeforeUnmount(() => disposers.forEach(dispose => dispose()))
}

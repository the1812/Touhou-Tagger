import { onBeforeUnmount, onMounted } from 'vue'

import { getApi, isFixtureMode } from '../api'
import { useOperationsStore } from '../stores/operations'
import { useSettingsStore } from '../stores/settings'
import { useWorkspaceStore } from '../stores/workspace'

export const useAppRuntime = () => {
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
    )
    await settings.load()
    if (
      import.meta.env.DEV &&
      isFixtureMode &&
      ['workspace', 'batch'].includes(
        new URLSearchParams(window.location.search).get('progress') ?? '',
      )
    ) {
      const { initializeProgressMock } = await import('../shared/ProgressMockPanel')
      await initializeProgressMock()
    }
    if (!isFixtureMode) {
      await workspace.loadStartupDirectory()
    }
  })

  onBeforeUnmount(() => disposers.forEach(dispose => dispose()))
}

import { onBeforeUnmount, onMounted } from 'vue'

import { useWriteOperationsStore, useSettingsStore } from '../../entities/session'
import { getApi, isFixtureMode } from '../../shared/api'

export const useAppRuntime = () => {
  const operations = useWriteOperationsStore()
  const settings = useSettingsStore()
  const disposers: Array<() => void> = []

  onMounted(async () => {
    const api = await getApi()
    disposers.push(api.onProgress(operations.receiveProgress))
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
  })

  onBeforeUnmount(() => disposers.forEach(dispose => dispose()))
}

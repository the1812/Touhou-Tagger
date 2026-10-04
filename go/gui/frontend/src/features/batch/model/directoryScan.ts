import { ref } from 'vue'

import { useNotificationsStore } from '../../../entities/session'
import { getApi } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import type { BatchSession } from './session'

export const useBatchDirectoryScan = (session: BatchSession, defaultSource: () => string) => {
  const directory = ref('')
  const depth = ref(1)
  const notifications = useNotificationsStore()

  const scan = async () => {
    if (!directory.value || session.isBusy.value) {
      return
    }
    session.activity.value = 'scanning'
    try {
      await session.discard()
      session.preview.value = await (
        await getApi()
      ).scanBatchDirectories(directory.value, depth.value, defaultSource())
      session.activity.value = undefined
      await session.loadPending()
    } catch (error) {
      notifications.error(t('notifications.scanBatchFailed'), error)
    } finally {
      session.activity.value = undefined
    }
  }
  const setDepth = async (value: number | null) => {
    if (value === null || value === depth.value || session.isBusy.value) {
      return
    }
    depth.value = value
    await scan()
  }
  const selectDirectory = async (target?: string) => {
    if (session.isBusy.value) {
      return
    }
    session.activity.value = 'selecting'
    try {
      const selected =
        target ?? (await (await getApi()).selectBatchDirectory(t('batch.selectDirectoryDialog')))
      if (selected) {
        directory.value = selected
        session.activity.value = undefined
        await scan()
      }
    } catch (error) {
      notifications.error(t('notifications.selectBatchDirectoryFailed'), error)
    } finally {
      session.activity.value = undefined
    }
  }
  return { directory, depth, scan, setDepth, selectDirectory }
}

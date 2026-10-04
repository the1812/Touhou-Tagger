import { useNotificationsStore } from '../../../entities/session'
import { getApi } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import type { BatchSession } from './session'

export const useBatchManualSelection = (session: BatchSession, defaultSource: () => string) => {
  const notifications = useNotificationsStore()
  const addDirectories = async (targets?: string[]) => {
    if (session.isBusy.value) {
      return
    }
    session.activity.value = 'selecting'
    try {
      const api = await getApi()
      const directories =
        targets ?? (await api.selectMultipleDirectories(t('batch.selectDirectoriesDialog')))
      if (directories.length === 0) {
        return
      }
      session.activity.value = 'scanning'
      const current = session.preview.value
      session.preview.value = current
        ? await api.addBatchDirectories(current.batchId, directories)
        : await api.createBatchFromDirectories(directories, defaultSource())
      session.activity.value = undefined
      await session.loadPending()
    } catch (error) {
      notifications.error(t('notifications.addBatchDirectoriesFailed'), error)
    } finally {
      session.activity.value = undefined
    }
  }
  const removeEntry = async (entryId: string) => {
    const current = session.preview.value
    if (!current || session.isBusy.value) {
      return
    }
    session.activity.value = 'updating'
    try {
      session.preview.value = await (await getApi()).removeBatchEntry(current.batchId, entryId)
    } catch (error) {
      notifications.error(t('notifications.removeBatchEntryFailed'), error)
    } finally {
      session.activity.value = undefined
    }
  }
  const refresh = async () => {
    if (session.isBusy.value) {
      return
    }
    await session.entries.loadEntries(session.preview.value?.entries.map(entry => entry.id) ?? [])
  }
  return { addDirectories, removeEntry, refresh }
}

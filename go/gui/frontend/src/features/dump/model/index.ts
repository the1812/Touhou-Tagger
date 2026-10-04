import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { useNotificationsStore, useWriteOperationsStore } from '../../../entities/session'
import { getApi, type DumpSummary } from '../../../shared/api'
import { t } from '../../../shared/i18n'

export const useDumpStore = defineStore('dump', () => {
  const summary = shallowRef<DumpSummary>()
  const activity = ref<'selecting' | 'scanning'>()
  const operations = useWriteOperationsStore()
  const notifications = useNotificationsStore()
  const saveAction = computed(() => operations.dumpAction)
  const canChangeDirectory = computed(() => activity.value !== 'scanning' && !operations.isWriting)
  const canExtract = computed(
    () => Boolean(summary.value?.audioCount) && !activity.value && !operations.isActive,
  )

  const scan = async (directory: string) => {
    if (!canChangeDirectory.value) {
      return
    }
    activity.value = 'scanning'
    try {
      summary.value = await (await getApi()).scanDump(directory)
    } catch (error) {
      notifications.error(t('dump.scanFailed'), error)
    } finally {
      activity.value = undefined
    }
  }
  const selectDirectory = async (directories?: string[]) => {
    if (directories && directories.length !== 1) {
      return
    }
    if (!canChangeDirectory.value || activity.value === 'selecting') {
      return
    }
    activity.value = 'selecting'
    try {
      const directory =
        directories?.[0] ?? (await (await getApi()).selectAlbumDirectory(t('dump.selectDirectory')))
      activity.value = undefined
      if (directory) {
        await scan(directory)
      }
    } catch (error) {
      notifications.error(t('notifications.selectAlbumDirectoryFailed'), error)
    } finally {
      activity.value = undefined
    }
  }
  const extract = async (directory: string, saveAs: boolean) => {
    if (!canExtract.value) {
      return
    }
    try {
      const result = await operations.dumpMetadata(directory, saveAs)
      if (result) {
        notifications.success(
          t('dump.complete', { count: result.audioCount }),
          '',
          result.directory,
        )
      }
    } catch (error) {
      notifications.error(t('dump.failed'), error)
    }
  }

  return {
    summary,
    activity,
    saveAction,
    canChangeDirectory,
    canExtract,
    scan,
    selectDirectory,
    extract,
  }
})

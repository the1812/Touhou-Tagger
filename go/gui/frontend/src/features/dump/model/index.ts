import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { useNotificationsStore, useWriteOperationsStore } from '../../../entities/session'
import {
  errorInfo,
  getApi,
  type DumpResult,
  type DumpSummary,
  type ErrorInfo,
} from '../../../shared/api'
import { t } from '../../../shared/i18n'

type DumpCompletion = { kind: 'result'; result: DumpResult } | { kind: 'failure'; error: ErrorInfo }

export const useDumpStore = defineStore('dump', () => {
  const summary = shallowRef<DumpSummary>()
  const activity = ref<'selecting' | 'scanning'>()
  const completion = shallowRef<DumpCompletion>()
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
    completion.value = undefined
    try {
      const result = await operations.dumpMetadata(directory, saveAs)
      if (result) {
        completion.value = { kind: 'result', result }
      }
    } catch (error) {
      completion.value = { kind: 'failure', error: errorInfo(error) }
    }
  }
  const reveal = async () => {
    if (completion.value?.kind !== 'result') {
      return
    }
    try {
      await (await getApi()).revealDirectory(completion.value.result.directory)
    } catch (error) {
      notifications.error(t('notifications.revealDirectoryFailed'), error)
    }
  }

  return {
    summary,
    activity,
    saveAction,
    completion,
    canChangeDirectory,
    canExtract,
    scan,
    selectDirectory,
    extract,
    reveal,
    closeCompletion: () => {
      completion.value = undefined
    },
  }
})

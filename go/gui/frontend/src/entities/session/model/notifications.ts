import { defineStore } from 'pinia'
import { ref } from 'vue'

import {
  errorInfo,
  errorMessage,
  issueText,
  resultTitle,
  type WriteOperationResult,
} from '../../../shared/api'
import { t } from '../../../shared/i18n'

export interface ProcessNotification {
  id: number
  severity: 'success' | 'info' | 'warn' | 'error'
  summary: string
  detail: string
  diagnostics?: string
  sticky: boolean
  directory?: string
  retry?: { disabled(): boolean; run(): void }
}

export const useNotificationsStore = defineStore('notifications', () => {
  const latest = ref<ProcessNotification>()
  const nextId = ref(1)
  const recent = new Map<string, number>()

  const error = (
    summary: string,
    errorValue: unknown,
    options: Partial<
      Pick<ProcessNotification, 'sticky' | 'diagnostics' | 'directory' | 'retry'>
    > = {},
  ) => {
    const failure = errorInfo(errorValue)
    const detail = errorMessage(failure)
    const key = `${summary}:${detail}`
    const now = Date.now()

    if (!options.retry && now - (recent.get(key) ?? 0) < 2500) {
      return
    }

    recent.set(key, now)
    const id = nextId.value
    nextId.value += 1
    latest.value = {
      id,
      severity: 'error',
      summary,
      detail,
      diagnostics: options.diagnostics ?? failure.details,
      sticky: options.sticky ?? false,
      directory: options.directory,
      retry: options.retry,
    }
  }

  const success = (summary: string, detail: string, directory?: string) => {
    const id = nextId.value
    nextId.value += 1
    latest.value = {
      id,
      severity: 'success',
      summary,
      detail,
      sticky: false,
      directory,
    }
  }

  const info = (summary: string, detail: string) => {
    const id = nextId.value
    nextId.value += 1
    latest.value = {
      id,
      severity: 'info',
      summary,
      detail,
      sticky: false,
    }
  }

  const complete = (
    result: WriteOperationResult,
    directory?: string,
    retry?: ProcessNotification['retry'],
  ) => {
    const diagnostics =
      result.kind === 'batch'
        ? result.entries
            .filter(entry => entry.outcome === 'failed')
            .map(
              entry =>
                `${entry.relativePath || entry.directory}: ${entry.issues.map(issueText).join('；')}`,
            )
            .join('\n')
        : undefined
    const detail =
      result.kind === 'batch' && result.failed > 0
        ? t('notifications.batchCompletedWithFailuresDetail', { count: result.failed })
        : ''
    const severity = (() => {
      if (result.failed > 0) {
        return 'warn'
      }
      return result.cancelled ? 'info' : 'success'
    })()
    latest.value = {
      id: nextId.value++,
      severity,
      summary: resultTitle(result),
      detail,
      diagnostics,
      sticky: false,
      directory,
      retry,
    }
  }

  return { latest, error, success, info, complete }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { t } from '../i18n'

export interface ProcessNotification {
  id: number
  severity: 'success' | 'info' | 'error'
  summary: string
  detail: string
  diagnostics?: string
  sticky: boolean
}

export const useNotificationsStore = defineStore('notifications', () => {
  const latest = ref<ProcessNotification>()
  const nextId = ref(1)
  const recent = new Map<string, number>()

  const error = (
    summary: string,
    errorValue: unknown,
    options: { sticky?: boolean; diagnostics?: string } = {},
  ) => {
    const detail =
      errorValue instanceof Error
        ? t('common.operationFailed')
        : typeof errorValue === 'string'
          ? errorValue
          : t('common.unknownError')
    const key = `${summary}:${detail}`
    const now = Date.now()

    if (now - (recent.get(key) ?? 0) < 2500) {
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
      diagnostics:
        options.diagnostics ?? (errorValue instanceof Error ? errorValue.stack : undefined),
      sticky: options.sticky ?? false,
    }
  }

  const success = (summary: string, detail: string) => {
    const id = nextId.value
    nextId.value += 1
    latest.value = {
      id,
      severity: 'success',
      summary,
      detail,
      sticky: false,
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

  return { latest, error, success, info }
})

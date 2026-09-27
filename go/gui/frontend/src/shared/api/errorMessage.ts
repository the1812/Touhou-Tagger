import { i18n, t } from '../i18n'
import type { ErrorInfo } from './types'

export const errorInfo = (value: unknown): ErrorInfo => {
  if (value instanceof Error) {
    const cause = value.cause as ErrorInfo | undefined
    return cause?.code
      ? { ...cause, details: [cause.details, value.stack].filter(Boolean).join('\n\n') }
      : { code: 'unknown', message: value.message, details: value.stack || value.message }
  }
  if (typeof value === 'string') {
    return { code: 'unknown', message: value, details: value }
  }
  const info = value as Partial<ErrorInfo> | null
  const message = info?.message || t('common.unknownError')
  return {
    code: info?.code || 'unknown',
    params: info?.params,
    message,
    details: info?.details || message,
  }
}

export const errorMessage = (info: ErrorInfo): string => {
  const key = `errors.${info.code}`
  return i18n.global.te(key) ? t(key, info.params ?? {}) : info.message
}

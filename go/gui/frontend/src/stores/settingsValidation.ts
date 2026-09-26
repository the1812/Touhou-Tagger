import type { Capabilities, Settings } from '../api'
import { t } from '../i18n'

export const validateSettings = (
  value: Settings | undefined,
  capabilities: Capabilities | undefined,
): Record<string, string> => {
  if (!value) {
    return {}
  }
  const next: Record<string, string> = {}
  if (!value.mp3MultiValueSeparator.trim()) {
    next.mp3MultiValueSeparator = t('validation.separatorRequired')
  }
  if (value.requestTimeoutSeconds < 1 || value.requestTimeoutSeconds > 300) {
    next.requestTimeoutSeconds = t('validation.requestTimeoutRange')
  }
  if (value.retryCount < 1 || value.retryCount > 10) {
    next.retryCount = t('validation.retryCountRange')
  }
  if (value.coverCompressionThresholdKb < 0) {
    next.coverCompressionThresholdKb = t('validation.coverThresholdNonNegative')
  }
  if (value.coverMaxEdge < 0) {
    next.coverMaxEdge = t('validation.coverMaxEdgeNonNegative')
  }
  if (value.writeLyricsMetadata && value.writeLrcFiles) {
    next.lyricDestination = t('validation.lyricDestinationConflict')
  }
  if (!value.mixedLyricSeparator.trim()) {
    next.mixedLyricSeparator = t('validation.mixedLyricSeparatorRequired')
  }
  if (value.lyricCacheSize < 1 || value.lyricCacheSize > 10000) {
    next.lyricCacheSize = t('validation.lyricCacheSizeRange')
  }
  if (
    capabilities &&
    !capabilities.sources.some(
      source => source.supportsSearch && source.value === value.defaultSource,
    )
  ) {
    next.defaultSource = t('validation.searchableSourceRequired')
  }
  return next
}

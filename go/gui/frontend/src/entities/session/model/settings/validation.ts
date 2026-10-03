import type { Capabilities, MetadataConfig } from '../../../../shared/api'
import { t } from '../../../../shared/i18n'

export const validateSettings = (
  value: MetadataConfig | undefined,
  capabilities: Capabilities | undefined,
): Record<string, string> => {
  if (!value) {
    return {}
  }
  const next: Record<string, string> = {}
  if (!value.separator.trim()) {
    next['separator'] = t('validation.separatorRequired')
  }
  if (value.timeout < 1 || value.timeout > 300) {
    next['timeout'] = t('validation.requestTimeoutRange')
  }
  if (value.retry < 1 || value.retry > 10) {
    next['retry'] = t('validation.retryCountRange')
  }
  if (value.coverCompressSize < 0) {
    next['coverCompressSize'] = t('validation.coverThresholdNonNegative')
  }
  if (value.coverCompressResolution < 0) {
    next['coverCompressResolution'] = t('validation.coverMaxEdgeNonNegative')
  }
  if (!value.lyric.translationSeparator.trim()) {
    next['lyric.translationSeparator'] = t('validation.mixedLyricSeparatorRequired')
  }
  if (value.lyric.maxCacheSize < 1 || value.lyric.maxCacheSize > 10000) {
    next['lyric.maxCacheSize'] = t('validation.lyricCacheSizeRange')
  }
  if (
    capabilities &&
    !capabilities.sources.some(source => source.supportsSearch && source.value === value.source)
  ) {
    next['source'] = t('validation.searchableSourceRequired')
  }
  return next
}

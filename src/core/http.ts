import packageJson from '../../package.json' with { type: 'json' }
import type { MetadataConfig } from './core-config.js'

export const defaultUserAgent = `touhou-tagger/${packageJson.version} (https://github.com/the1812/Touhou-Tagger)`

export const getHttpRequestOptions = (config: Pick<MetadataConfig, 'timeout' | 'userAgent'>) => ({
  headers: { 'User-Agent': config.userAgent ?? defaultUserAgent },
  timeout: config.timeout * 1000,
})

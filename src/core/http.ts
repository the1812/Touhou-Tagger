import { setTimeout } from 'node:timers/promises'

import axios from 'axios'

import packageJson from '../../package.json' with { type: 'json' }
import type { MetadataConfig } from './core-config.js'

export const defaultUserAgent = `touhou-tagger/${packageJson.version} (https://github.com/the1812/Touhou-Tagger)`

export const getHttpRequestOptions = (config: Pick<MetadataConfig, 'timeout' | 'userAgent'>) => ({
  headers: { 'User-Agent': config.userAgent ?? defaultUserAgent },
  timeout: config.timeout * 1000,
})

export const createRateLimitedClient = (baseURL: string, interval: number) => {
  const client = axios.create({ baseURL, headers: { 'User-Agent': defaultUserAgent } })
  let nextRequest = 0
  let ready = Promise.resolve()
  client.interceptors.request.use(async request => {
    const previous = ready
    let release!: () => void
    ready = new Promise<void>(resolve => {
      release = resolve
    })
    await previous
    try {
      const delay = Math.max(0, nextRequest - Date.now())
      if (delay > 0) {
        await setTimeout(delay, undefined, { signal: request.signal as AbortSignal | undefined })
      }
      nextRequest = Date.now() + interval
      return request
    } finally {
      release()
    }
  })
  return client
}

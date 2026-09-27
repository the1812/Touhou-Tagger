import { createI18n } from 'vue-i18n'

import zhCN from './locales/zh-CN.json'

export { zhCN }

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
  },
})

export const { t } = i18n.global

const sourceKeys: Record<string, string> = {
  'thb-wiki': 'data.sources.thbWiki',
  'doujin-meta': 'data.sources.doujinMeta',
  'music-brainz': 'data.sources.musicBrainz',
  discogs: 'data.sources.discogs',
  'local-json': 'data.sources.localJson',
  local: 'data.localCover',
  none: 'data.noCover',
}

export const sourceLabel = (source: string) => (sourceKeys[source] ? t(sourceKeys[source]) : source)

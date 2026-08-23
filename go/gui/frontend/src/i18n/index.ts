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

import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import type { SelectPassThroughMethodOptions } from 'primevue/select'
import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'

import { App } from './App'
import { router } from './app/router'
import { TouhouTaggerPreset } from './app/theme'
import { initializeThemeMode } from './app/themeMode'
import { Tooltip } from './app/tooltip'
import { i18n, zhCN } from './i18n'

import './tailwind.css'

initializeThemeMode()

createApp(App)
  .use(createPinia())
  .use(i18n)
  .use(router)
  .use(PrimeVue, {
    ripple: true,
    locale: zhCN.primevue,
    pt: {
      select: {
        overlay: ({ props }: SelectPassThroughMethodOptions<unknown>) => ({
          style: {
            fontSize: {
              small: 'var(--p-select-sm-font-size)',
              large: 'var(--p-select-lg-font-size)',
            }[props.size as 'small' | 'large'],
          },
        }),
      },
    },
    theme: {
      preset: TouhouTaggerPreset,
      options: {
        darkModeSelector: '.app-dark',
        cssLayer: {
          name: 'primevue',
          order: 'theme, base, primevue',
        },
      },
    },
  })
  .use(ToastService)
  .use(ConfirmationService)
  .directive('tooltip', Tooltip)
  .mount('#app')

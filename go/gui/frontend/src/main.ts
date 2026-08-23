import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createApp } from 'vue'

import { App } from './App'
import { router } from './app/router'
import { TouhouTaggerPreset } from './app/theme'
import { i18n, zhCN } from './i18n'

import './tailwind.css'

createApp(App)
  .use(createPinia())
  .use(i18n)
  .use(router)
  .use(PrimeVue, {
    ripple: true,
    locale: zhCN.primevue,
    theme: {
      preset: TouhouTaggerPreset,
      options: {
        darkModeSelector: 'system',
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

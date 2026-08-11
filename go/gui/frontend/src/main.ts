import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createPinia } from 'pinia'

import { App } from './App'
import { router } from './app/router'
import { TouhouTaggerPreset } from './app/theme'

import './style.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PrimeVue, {
    ripple: true,
    theme: {
      preset: TouhouTaggerPreset,
      options: {
        darkModeSelector: 'system',
        cssLayer: false,
      },
    },
  })
  .use(ToastService)
  .use(ConfirmationService)
  .directive('tooltip', Tooltip)
  .mount('#app')

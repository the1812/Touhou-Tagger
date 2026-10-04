import { defineAsyncComponent } from 'vue'

export const ProgressMockLoader = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./ProgressPanel').then(module => module.ProgressMockPanel))
  : undefined

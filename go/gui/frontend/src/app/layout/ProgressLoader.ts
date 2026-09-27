import { defineAsyncComponent } from 'vue'

export const ProgressMockLoader = defineAsyncComponent(() =>
  import('./ProgressPanel').then(module => module.ProgressMockPanel),
)

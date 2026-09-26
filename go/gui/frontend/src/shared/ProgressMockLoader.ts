import { defineAsyncComponent } from 'vue'

export const ProgressMockLoader = defineAsyncComponent(() =>
  import('./ProgressMockPanel').then(module => module.ProgressMockPanel),
)

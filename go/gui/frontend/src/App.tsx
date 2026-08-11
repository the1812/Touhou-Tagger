import { defineComponent } from 'vue'

import { AppShell } from './shared/AppShell'

export const App = defineComponent({
  name: 'App',
  setup: () => () => <AppShell />,
})

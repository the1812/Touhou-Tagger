import { defineComponent } from 'vue'

import { providePageCommandRegistry } from './app/pageCommands'
import { useAppRuntime } from './app/runtime'
import { AppShell } from './shared/AppShell'

export const App = defineComponent({
  name: 'App',
  setup() {
    providePageCommandRegistry()
    useAppRuntime()
    return () => <AppShell />
  },
})

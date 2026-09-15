import { defineAsyncComponent, defineComponent } from 'vue'

import { isFixtureMode } from './api'
import { providePageCommandRegistry } from './app/pageCommands'
import { useAppRuntime } from './app/runtime'
import { AppShell } from './shared/AppShell'

const showProgressMock =
  isFixtureMode &&
  ['workspace', 'batch'].includes(new URLSearchParams(window.location.search).get('progress') ?? '')
const ProgressMockPanel = import.meta.env.DEV
  ? defineAsyncComponent(() =>
      import('./shared/ProgressMockPanel').then(module => module.ProgressMockPanel),
    )
  : undefined

export const App = defineComponent({
  name: 'App',
  setup() {
    providePageCommandRegistry()
    useAppRuntime()
    return () =>
      showProgressMock && ProgressMockPanel ? (
        <div class="flex h-screen flex-col">
          <div class="min-h-0 flex-1 overflow-hidden [&>.grid]:h-full">
            <AppShell />
          </div>
          <ProgressMockPanel />
        </div>
      ) : (
        <AppShell />
      )
  },
})

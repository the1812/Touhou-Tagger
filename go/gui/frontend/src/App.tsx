import { defineComponent } from 'vue'

import { isFixtureMode } from './api'
import { providePageCommandRegistry } from './app/pageCommands'
import { useAppRuntime } from './app/runtime'
import { ProgressMockLoader } from './features/fixture/ProgressLoader'
import { AppShell } from './shared/AppShell'

const showProgressMock =
  import.meta.env.DEV &&
  isFixtureMode &&
  ['workspace', 'batch'].includes(new URLSearchParams(window.location.search).get('progress') ?? '')

export const App = defineComponent({
  name: 'App',
  setup() {
    providePageCommandRegistry()
    useAppRuntime()
    return () =>
      showProgressMock ? (
        <div class="flex h-screen flex-col">
          <div class="min-h-0 flex-1 overflow-hidden [&>.grid]:h-full">
            <AppShell />
          </div>
          <ProgressMockLoader />
        </div>
      ) : (
        <AppShell />
      )
  },
})

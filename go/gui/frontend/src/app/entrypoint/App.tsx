import { defineComponent } from 'vue'

import { isFixtureMode } from '../../shared/api'
import { providePageCommandRegistry } from '../../shared/lib'
import { AppShell } from '../layout/AppShell'
import { ProgressMockLoader } from '../layout/ProgressLoader'
import { useAppRuntime } from '../model/runtime'

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

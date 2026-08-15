import { storeToRefs } from 'pinia'
import { computed, defineComponent, onBeforeUnmount, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { isFixtureMode } from '../api'
import { navigationItems } from '../app/navigation'
import { usePageCommandRegistry } from '../app/pageCommands'
import { useOperationsStore } from '../stores/operations'
import { ToastHost } from './ToastHost'

export const AppShell = defineComponent({
  name: 'AppShell',
  setup() {
    const route = useRoute()
    const commands = usePageCommandRegistry()
    const operations = useOperationsStore()
    const { current: currentOperation } = storeToRefs(operations)
    const pageTitle = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : ''))

    const onKeydown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLocaleLowerCase() === 'o' && commands.run('openDirectory')) {
        event.preventDefault()
      }

      if (event.key === 'F5' && commands.run('refresh')) {
        event.preventDefault()
      }

      if (event.ctrlKey && event.key.toLocaleLowerCase() === 'f' && commands.run('focusSearch')) {
        event.preventDefault()
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', onKeydown)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onKeydown)
    })

    return () => (
      <>
        <div class="grid h-screen grid-cols-[216px_minmax(0,1fr)] overflow-hidden">
          <aside class="flex min-w-0 flex-col border-r border-surface-200 bg-gradient-to-b from-white/70 to-surface-50/90 px-3 py-4 dark:border-surface-700 dark:from-surface-800/95 dark:to-surface-900/95">
            <nav class="grid gap-1">
              {navigationItems.map(item => {
                const Icon = item.icon
                return (
                  <RouterLink key={item.path} to={item.path} class="app-nav-item">
                    <Icon size={19} />
                    <span>{item.title}</span>
                  </RouterLink>
                )
              })}
            </nav>

            {isFixtureMode && (
              <div class="status-chip mx-1 mt-auto gap-2 rounded-lg px-2.5 py-2 text-[.68rem]">
                <span class="size-[7px] rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--p-primary-color)_13%,transparent)]" />
                离线 Fixture 模式
              </div>
            )}
          </aside>

          <section class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
            <header class="flex min-h-16 items-center justify-between gap-4 border-b border-surface-200 bg-surface-0/90 px-6 py-4 dark:border-surface-700 dark:bg-surface-900/90">
              <h1 class="m-0 text-xl font-bold tracking-tight">{pageTitle.value}</h1>
              {currentOperation.value && (
                <div class="status-chip max-w-[40%] gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-full px-2.5 py-2 text-xs">
                  <span class="size-[7px] shrink-0 animate-pulse rounded-full bg-primary" />
                  {currentOperation.value.message}
                </div>
              )}
            </header>

            <main class="app-scrollbar min-h-0 min-w-0 overflow-auto px-6 py-5">
              <RouterView />
            </main>
            <div id="page-action-bar" class="empty:hidden" />
          </section>
        </div>
        <ToastHost />
      </>
    )
  },
})

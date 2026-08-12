import { FilePenLine, ListChecks, Settings } from 'lucide-vue-next'
import { computed, defineComponent, onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { getApi, isFixtureMode } from '../api'
import { useBatchStore } from '../stores/batch'
import { useNotificationsStore } from '../stores/notifications'
import { useSettingsStore } from '../stores/settings'
import { useWorkspaceStore } from '../stores/workspace'
import { ToastHost } from './ToastHost'

const navItems = [
  { to: '/tagging', label: '写入', icon: FilePenLine },
  { to: '/batch', label: '批处理', icon: ListChecks },
  { to: '/settings', label: '设置', icon: Settings },
]

export const AppShell = defineComponent({
  name: 'AppShell',
  setup() {
    const route = useRoute()
    const workspace = useWorkspaceStore()
    const batch = useBatchStore()
    const notifications = useNotificationsStore()
    const settings = useSettingsStore()
    const pageTitle = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : ''))
    const disposers: Array<() => void> = []

    watch(
      () => settings.saved?.defaultSource,
      defaultSource => {
        if (!defaultSource) {
          return
        }
        workspace.initializeSource(defaultSource)
        batch.initializeSource(defaultSource)
      },
    )

    const onKeydown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLocaleLowerCase() === 'o') {
        event.preventDefault()
        if (route.name === 'batch') {
          batch.selectDirectory()
        } else if (route.name === 'tagging') {
          workspace.selectDirectory()
        }
      }

      if (event.key === 'F5' && route.name === 'tagging' && workspace.directory) {
        event.preventDefault()
        workspace.scan()
      }

      if (event.ctrlKey && event.key.toLocaleLowerCase() === 'f' && route.name === 'tagging') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('#album-search')?.focus()
      }
    }

    onMounted(async () => {
      window.addEventListener('keydown', onKeydown)
      const api = await getApi()
      disposers.push(
        api.onProgress(progress => {
          workspace.receiveProgress(progress)
          batch.receiveProgress(progress)
        }),
        api.onComplete(result => {
          workspace.receiveComplete(result)
          batch.receiveComplete(result)
        }),
        api.onFailure(failure => {
          workspace.receiveFailure(failure)
          batch.receiveFailure(failure)
        }),
        api.onProcessError(error => {
          notifications.error('操作未完全完成', error.message, {
            diagnostics: error.details,
          })
        }),
      )
      await settings.load()
      if (settings.saved) {
        workspace.initializeSource(settings.saved.defaultSource)
        batch.initializeSource(settings.saved.defaultSource)
      }
      if (!isFixtureMode && workspace.phase === 'idle') {
        try {
          const startupDirectory = await api.getStartupDirectory()
          if (startupDirectory) {
            await workspace.scan(startupDirectory)
          }
        } catch (error) {
          notifications.error('无法加载启动工作区', error)
        }
      }
    })

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onKeydown)
      disposers.forEach(dispose => dispose())
    })

    return () => (
      <>
        <div class="grid h-screen grid-cols-[216px_minmax(0,1fr)] overflow-hidden">
          <aside class="flex min-w-0 flex-col border-r border-surface-200 bg-gradient-to-b from-white/70 to-surface-50/90 px-3 py-4 dark:border-surface-700 dark:from-surface-800/95 dark:to-surface-900/95">
            <nav class="grid gap-1">
              {navItems.map(item => {
                const Icon = item.icon
                return (
                  <RouterLink
                    key={item.to}
                    to={item.to}
                    class="app-nav-item"
                  >
                    <Icon size={19} />
                    <span>{item.label}</span>
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

          <section class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
            <header class="flex min-h-16 items-center justify-between gap-4 border-b border-surface-200 bg-surface-0/90 px-6 py-4 dark:border-surface-700 dark:bg-surface-900/90">
              <h1 class="m-0 text-xl font-bold tracking-tight">{pageTitle.value}</h1>
              {(workspace.operation || batch.operation) && (
                <div class="status-chip max-w-[40%] gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-full px-2.5 py-2 text-xs">
                  <span class="size-[7px] shrink-0 animate-pulse rounded-full bg-primary" />
                  {workspace.operation?.message ?? batch.operation?.message}
                </div>
              )}
            </header>

            <main class="app-scrollbar min-h-0 min-w-0 overflow-auto px-6 py-5">
              <RouterView />
            </main>
          </section>
        </div>
        <ToastHost />
      </>
    )
  },
})

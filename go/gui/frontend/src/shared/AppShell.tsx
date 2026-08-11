import { computed, defineComponent, onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { FilePenLine, ListChecks, Settings } from 'lucide-vue-next'

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
    const pageTitle = computed(() => String(route.meta.title ?? ''))
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
          void batch.selectDirectory()
        } else if (route.name === 'tagging') {
          void workspace.selectDirectory()
        }
      }

      if (event.key === 'F5' && route.name === 'tagging' && workspace.directory) {
        event.preventDefault()
        void workspace.scan()
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
        <div class="app-shell">
          <aside class="app-sidebar">
            <nav class="app-nav" aria-label="主导航">
              {navItems.map(item => {
                const Icon = item.icon
                return (
                  <RouterLink key={item.to} to={item.to} class="app-nav__item">
                    <Icon size={19} aria-hidden="true" />
                    <span>{item.label}</span>
                  </RouterLink>
                )
              })}
            </nav>

            {isFixtureMode && (
              <div class="fixture-badge">
                <span class="fixture-badge__dot" />
                离线 Fixture 模式
              </div>
            )}
          </aside>

          <section class="app-main">
            <header class="app-header">
              <h1>{pageTitle.value}</h1>
              {(workspace.operation || batch.operation) && (
                <div class="global-operation">
                  <span class="global-operation__pulse" />
                  {workspace.operation?.message ?? batch.operation?.message}
                </div>
              )}
            </header>

            <main class="app-content">
              <RouterView />
            </main>
          </section>
        </div>
        <ToastHost />
      </>
    )
  },
})

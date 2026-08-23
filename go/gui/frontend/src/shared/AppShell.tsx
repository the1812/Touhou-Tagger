import { Settings } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import Tabs from 'primevue/tabs'
import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import { settingsNavigationItem, workspaceNavigationItems } from '../app/navigation'
import { usePageCommandRegistry } from '../app/pageCommands'
import { t } from '../i18n'
import { useOperationsStore } from '../stores/operations'
import { ToastHost } from './ToastHost'

export const AppShell = defineComponent({
  name: 'AppShell',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const commands = usePageCommandRegistry()
    const operations = useOperationsStore()
    const { current: currentOperation } = storeToRefs(operations)
    const selectedTab = ref('')
    const syncSelectedTab = () => {
      selectedTab.value = workspaceNavigationItems.some(item => item.path === route.path)
        ? route.path
        : ''
    }
    const navigateToTab = async (value: string | number) => {
      const path = String(value)
      if (path !== route.path) {
        selectedTab.value = path
        try {
          await router.push(path)
        } finally {
          syncSelectedTab()
        }
      }
    }

    watch(() => route.path, syncSelectedTab, { immediate: true })

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
        <div class="grid h-screen min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <header class="flex min-h-16 items-center gap-4 border-b border-surface-200 bg-surface-0/90 pr-4 dark:border-surface-700 dark:bg-surface-900/90">
            <nav class="min-w-0 flex-1" aria-label={t('navigation.primary')}>
              <Tabs
                value={selectedTab.value}
                class="app-top-tabs"
                {...{ 'onUpdate:value': navigateToTab }}
              >
                <TabList>
                  {workspaceNavigationItems.map(item => {
                    const Icon = item.icon
                    return (
                      <Tab key={item.path} value={item.path}>
                        <Icon size={17} />
                        <span>{t(item.titleKey)}</span>
                      </Tab>
                    )
                  })}
                </TabList>
              </Tabs>
            </nav>
            <div class="flex shrink-0 items-center gap-3">
              {currentOperation.value && (
                <div class="status-chip max-w-80 gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-full px-2.5 py-2 text-xs">
                  <span class="size-[7px] shrink-0 animate-pulse rounded-full bg-primary" />
                  {currentOperation.value.message}
                </div>
              )}
              <RouterLink
                to={settingsNavigationItem.path}
                aria-label={t(settingsNavigationItem.titleKey)}
                class={[
                  'grid size-9 place-items-center rounded-lg text-muted-color transition-colors hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:hover:bg-primary-950',
                  { 'bg-primary-50 text-primary dark:bg-primary-950': route.name === 'settings' },
                ]}
                v-tooltip={{ value: t(settingsNavigationItem.titleKey), position: 'bottom' }}
              >
                <Settings size={19} />
              </RouterLink>
            </div>
          </header>

          <main class="app-scrollbar min-h-0 min-w-0 overflow-auto px-6 py-5">
            <RouterView />
          </main>
          <div id="page-action-bar" class="empty:hidden" />
        </div>
        <ToastHost />
      </>
    )
  },
})

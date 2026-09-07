import { Monitor, Moon, Settings, Sun } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import Tabs from 'primevue/tabs'
import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import { settingsNavigationItem, workspaceNavigationItems } from '../app/navigation'
import { usePageCommandRegistry } from '../app/pageCommands'
import { useThemeMode, type ThemeMode } from '../app/themeMode'
import { t } from '../i18n'
import { useOperationsStore } from '../stores/operations'
import { cx } from './classNames'
import { ToastHost } from './ToastHost'

export const AppShell = defineComponent({
  name: 'AppShell',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const commands = usePageCommandRegistry()
    const operations = useOperationsStore()
    const { current: currentOperation } = storeToRefs(operations)
    const { themeMode, nextThemeMode, cycleThemeMode } = useThemeMode()
    const selectedTab = ref('')
    const themeIcons: Record<ThemeMode, typeof Monitor> = {
      system: Monitor,
      light: Sun,
      dark: Moon,
    }
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
          <div
            class={[
              'flex min-h-app-header items-center gap-4 border-b pr-app-page-x',
              'border-surface-200 bg-app-header dark:border-surface-700 dark:bg-app-header-dark',
            ]}
          >
            <div class="min-w-0 flex-1">
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
                        <Icon />
                        <div>{t(item.titleKey)}</div>
                      </Tab>
                    )
                  })}
                </TabList>
              </Tabs>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              {currentOperation.value && (
                <div
                  class={[
                    'status-chip max-w-80 gap-2 overflow-hidden text-ellipsis whitespace-nowrap',
                    'rounded-full px-2.5 py-2 text-xs',
                  ]}
                >
                  <div class="size-[7px] shrink-0 animate-pulse rounded-full bg-primary" />
                  {currentOperation.value.message}
                </div>
              )}
              <Button
                text
                severity="secondary"
                onClick={cycleThemeMode}
                v-tooltip={[
                  {
                    value: t('theme.switchTo', { mode: t(`theme.${nextThemeMode.value}`) }),
                    class: 'app-theme-tooltip',
                  },
                  undefined,
                  ['bottom'],
                ]}
              >
                {{
                  icon: () => {
                    const ThemeIcon = themeIcons[themeMode.value]
                    return <ThemeIcon />
                  },
                }}
              </Button>
              <Button
                as={RouterLink}
                {...{ to: settingsNavigationItem.path }}
                text
                severity={route.name === 'settings' ? 'primary' : 'secondary'}
                v-tooltip={[t(settingsNavigationItem.titleKey), undefined, ['bottom']]}
              >
                {{ icon: () => <Settings /> }}
              </Button>
            </div>
          </div>

          <div
            class={cx(
              'app-scrollbar min-h-0 min-w-0',
              'bg-app-content dark:bg-app-content-dark',
              route.name === 'settings'
                ? 'overflow-hidden p-0'
                : 'overflow-auto px-app-page-x py-app-page-y',
            )}
          >
            <RouterView />
          </div>
          <div id="page-action-bar" class="empty:hidden" />
        </div>
        <ToastHost />
      </>
    )
  },
})

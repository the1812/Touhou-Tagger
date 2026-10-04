import { inject, type InjectionKey, onBeforeUnmount, onMounted, provide } from 'vue'

export interface PageCommands {
  openDirectory?: (directories?: string[]) => boolean | Promise<void>
  refresh?: (() => boolean) | (() => void | Promise<void>)
  focusSearch?: (() => boolean) | (() => void)
}

interface PageCommandRegistry {
  register(commands: PageCommands): () => void
  run(command: keyof PageCommands, directories?: string[]): boolean
}

const pageCommandRegistryKey: InjectionKey<PageCommandRegistry> = Symbol('page-command-registry')

export const providePageCommandRegistry = (): PageCommandRegistry => {
  let current: PageCommands = {}
  const registry: PageCommandRegistry = {
    register(commands) {
      current = commands
      return () => {
        if (current === commands) {
          current = {}
        }
      }
    },
    run(command, directories) {
      const handler = current[command]
      if (!handler) {
        return false
      }
      return handler(directories) !== false
    },
  }
  provide(pageCommandRegistryKey, registry)
  return registry
}

export const usePageCommandRegistry = () => inject(pageCommandRegistryKey) as PageCommandRegistry

export const usePageCommands = (commands: PageCommands) => {
  const registry = usePageCommandRegistry()
  let unregister: (() => void) | undefined
  onMounted(() => {
    unregister = registry.register(commands)
  })
  onBeforeUnmount(() => unregister?.())
}

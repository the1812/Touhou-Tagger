import { DatabaseArrowDown, FileUp, ListChecks } from '@lucide/vue'

export const workspaceNavigationItems = [
  { path: '/tagging', name: 'tagging', titleKey: 'navigation.tagging', icon: DatabaseArrowDown },
  { path: '/batch', name: 'batch', titleKey: 'navigation.batch', icon: ListChecks },
  { path: '/dump', name: 'dump', titleKey: 'navigation.dump', icon: FileUp },
] as const

export const settingsNavigationItem = {
  path: '/settings',
  name: 'settings',
  titleKey: 'navigation.settings',
} as const

export const navigationItems = [...workspaceNavigationItems, settingsNavigationItem] as const

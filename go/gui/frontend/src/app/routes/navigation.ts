import { Download, FilePenLine, ListChecks } from 'lucide-vue-next'

export const workspaceNavigationItems = [
  { path: '/tagging', name: 'tagging', titleKey: 'navigation.tagging', icon: FilePenLine },
  { path: '/batch', name: 'batch', titleKey: 'navigation.batch', icon: ListChecks },
  { path: '/dump', name: 'dump', titleKey: 'navigation.dump', icon: Download },
] as const

export const settingsNavigationItem = {
  path: '/settings',
  name: 'settings',
  titleKey: 'navigation.settings',
} as const

export const navigationItems = [...workspaceNavigationItems, settingsNavigationItem] as const

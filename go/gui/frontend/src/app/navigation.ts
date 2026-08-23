import { FilePenLine, ListChecks, Settings } from 'lucide-vue-next'

export const navigationItems = [
  { path: '/tagging', name: 'tagging', titleKey: 'navigation.tagging', icon: FilePenLine },
  { path: '/batch', name: 'batch', titleKey: 'navigation.batch', icon: ListChecks },
  { path: '/settings', name: 'settings', titleKey: 'navigation.settings', icon: Settings },
] as const

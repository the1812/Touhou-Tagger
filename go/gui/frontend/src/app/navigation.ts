import { FilePenLine, ListChecks, Settings } from 'lucide-vue-next'

export const navigationItems = [
  { path: '/tagging', name: 'tagging', title: '写入', icon: FilePenLine },
  { path: '/batch', name: 'batch', title: '批量写入', icon: ListChecks },
  { path: '/settings', name: 'settings', title: '设置', icon: Settings },
] as const

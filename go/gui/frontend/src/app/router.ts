import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/tagging',
    },
    {
      path: '/tagging',
      name: 'tagging',
      component: () => import('../features/tagging/TaggingPage').then(({ TaggingPage }) => TaggingPage),
      meta: {
        title: '写入',
      },
    },
    {
      path: '/batch',
      name: 'batch',
      component: () => import('../features/batch/BatchPage').then(({ BatchPage }) => BatchPage),
      meta: {
        title: '批量写入',
      },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../features/settings/SettingsPage').then(({ SettingsPage }) => SettingsPage),
      meta: {
        title: '设置',
      },
    },
  ],
})

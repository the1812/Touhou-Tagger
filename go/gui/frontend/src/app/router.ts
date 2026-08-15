import { createRouter, createWebHashHistory } from 'vue-router'

import { navigationItems } from './navigation'

const components = {
  tagging: () => import('../features/tagging/TaggingPage').then(({ TaggingPage }) => TaggingPage),
  batch: () => import('../features/batch/BatchPage').then(({ BatchPage }) => BatchPage),
  settings: () =>
    import('../features/settings/SettingsPage').then(({ SettingsPage }) => SettingsPage),
}

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/tagging',
    },
    ...navigationItems.map(item => ({
      path: item.path,
      name: item.name,
      component: components[item.name],
      meta: { title: item.title },
    })),
  ],
})

import { createRouter, createWebHashHistory } from 'vue-router'

import { navigationItems } from './navigation'

const components = {
  tagging: () => import('../../pages/tagging').then(({ TaggingPage }) => TaggingPage),
  batch: () => import('../../pages/batch').then(({ BatchPage }) => BatchPage),
  settings: () => import('../../pages/settings').then(({ SettingsPage }) => SettingsPage),
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
      meta: { titleKey: item.titleKey },
    })),
  ],
})

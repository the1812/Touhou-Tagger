import type { GUIApi } from './types'

export * from './types'

const fixtureRequested =
  import.meta.env.DEV &&
  (import.meta.env.VITE_GUI_FIXTURE_MODE === '1' ||
    new URLSearchParams(window.location.search).get('fixture') === '1')

let apiPromise: Promise<GUIApi> | undefined

export const isFixtureMode = fixtureRequested

export const getApi = (): Promise<GUIApi> => {
  apiPromise ??= fixtureRequested
    ? import('./fixture').then(({ fixtureApi }) => fixtureApi)
    : import('./native').then(({ nativeApi }) => nativeApi)
  return apiPromise
}

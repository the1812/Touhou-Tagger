import type { GUIApi } from './types'

export * from './types'
export {
  batchMatchText,
  batchStatusInfo,
  failureTitle,
  issueText,
  progressText,
  resultTitle,
} from './display'
export { errorInfo, errorMessage } from './errorMessage'

const fixtureRequested =
  import.meta.env.VITE_GUI_FIXTURE_MODE === '1' ||
  new URLSearchParams(window.location.search).get('fixture') === '1'

let apiPromise: Promise<GUIApi> | undefined

export const isFixtureMode = import.meta.env.DEV && fixtureRequested

export const getApi = (): Promise<GUIApi> => {
  apiPromise ??= isFixtureMode
    ? import('../fixture-api').then(({ fixtureApi }) => fixtureApi)
    : import('./native').then(({ nativeApi }) => nativeApi)
  return apiPromise
}

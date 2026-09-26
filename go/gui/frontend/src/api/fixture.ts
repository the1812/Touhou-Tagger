import { fixtureBatchApi } from './fixtureBatch'
import { capabilities, defaultSettings } from './fixtureData'
import { clone, fixtureState, wait } from './fixtureState'
import { fixtureWorkspaceApi } from './fixtureWorkspace'
import type { GUIApi } from './types'

export const fixtureApi: GUIApi = {
  ...fixtureWorkspaceApi,
  ...fixtureBatchApi,
  setDarkMode: async () => {},
  async getCapabilities() {
    await wait()
    return clone(capabilities)
  },

  getStartupDirectory() {
    return Promise.resolve('')
  },

  async revealDirectory() {
    await wait()
  },

  async loadSettings() {
    await wait()
    return clone(fixtureState.settings)
  },

  async saveSettings(nextSettings) {
    await wait(120)
    fixtureState.settings = clone(nextSettings)
    return clone(fixtureState.settings)
  },

  async resetSettings() {
    await wait()
    fixtureState.settings = clone(defaultSettings)
    return clone(fixtureState.settings)
  },

  onDirectoryDrop(handler) {
    const listener = (event: Event) => handler((event as CustomEvent<string>).detail)
    window.addEventListener('fixture:directory-drop', listener)
    return () => window.removeEventListener('fixture:directory-drop', listener)
  },

  onProgress(handler) {
    fixtureState.progressHandlers.add(handler)
    return () => fixtureState.progressHandlers.delete(handler)
  },

  onComplete(handler) {
    fixtureState.completeHandlers.add(handler)
    return () => fixtureState.completeHandlers.delete(handler)
  },

  onFailure(handler) {
    fixtureState.failureHandlers.add(handler)
    return () => fixtureState.failureHandlers.delete(handler)
  },
}

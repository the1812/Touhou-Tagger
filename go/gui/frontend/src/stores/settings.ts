import { defineStore } from 'pinia'
import { computed, ref, toRaw, watch } from 'vue'

import { getApi, type Capabilities, type Settings } from '../api'
import { t } from '../i18n'
import { useNotificationsStore } from './notifications'
import { validateSettings } from './settingsValidation'

const settingsEqual = (left?: Settings, right?: Settings) =>
  Boolean(left && right && JSON.stringify(left) === JSON.stringify(right))

const cloneSettings = (settings: Settings) => structuredClone(toRaw(settings))

const autoSaveDelay = 400

export const useSettingsStore = defineStore('settings', () => {
  const saved = ref<Settings>()
  const draft = ref<Settings>()
  const capabilities = ref<Capabilities>()
  const loading = ref(false)
  const saving = ref(false)
  const notifications = useNotificationsStore()
  let loadPromise: Promise<void> | undefined
  let savePromise: Promise<boolean> | undefined
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const saveQueued = ref(false)

  const dirty = computed(() => !settingsEqual(saved.value, draft.value))
  const errors = computed(() => validateSettings(draft.value, capabilities.value))
  const valid = computed(() => Object.keys(errors.value).length === 0)

  const load = () => {
    if (draft.value) {
      return Promise.resolve()
    }
    loadPromise ??= (async () => {
      loading.value = true
      try {
        const api = await getApi()
        const [nextSettings, nextCapabilities] = await Promise.all([
          api.loadSettings(),
          api.getCapabilities(),
        ])
        saved.value = cloneSettings(nextSettings)
        draft.value = cloneSettings(nextSettings)
        capabilities.value = nextCapabilities
      } catch (error) {
        notifications.error(t('notifications.loadSettingsFailed'), error)
      } finally {
        loading.value = false
        loadPromise = undefined
      }
    })()
    return loadPromise
  }

  const clearSaveTimer = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
  }

  function save(): Promise<boolean> {
    clearSaveTimer()
    if (!draft.value || !valid.value || !dirty.value) {
      return Promise.resolve(!dirty.value)
    }
    if (savePromise) {
      saveQueued.value = true
      return savePromise
    }

    const snapshot = cloneSettings(draft.value)
    saving.value = true
    saveQueued.value = false
    savePromise = (async () => {
      try {
        const api = await getApi()
        const nextSettings = await api.saveSettings(snapshot)
        saved.value = cloneSettings(nextSettings)
        if (settingsEqual(draft.value, snapshot)) {
          draft.value = cloneSettings(nextSettings)
        }
        return true
      } catch (error) {
        notifications.error(t('notifications.autoSaveSettingsFailed'), error)
        return false
      } finally {
        saving.value = false
        savePromise = undefined
        if (saveQueued.value) {
          saveQueued.value = false
          saveTimer = setTimeout(() => {
            saveTimer = undefined
            void save()
          }, autoSaveDelay)
        }
      }
    })()
    return savePromise
  }

  function scheduleSave() {
    clearSaveTimer()
    if (!draft.value || !dirty.value || !valid.value) {
      return
    }
    if (saving.value) {
      saveQueued.value = true
      return
    }
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void save()
    }, autoSaveDelay)
  }

  const flush = async () => {
    clearSaveTimer()
    const savedCurrentDraft = await save()
    if (!savedCurrentDraft) {
      return false
    }
    if (dirty.value && valid.value) {
      return save()
    }
    return !dirty.value
  }

  const reset = async () => {
    clearSaveTimer()
    saving.value = true
    try {
      const api = await getApi()
      const nextSettings = await api.resetSettings()
      saved.value = cloneSettings(nextSettings)
      draft.value = cloneSettings(nextSettings)
      notifications.success(
        t('notifications.settingsReset'),
        t('notifications.settingsResetDetail'),
      )
    } catch (error) {
      notifications.error(t('notifications.resetSettingsFailed'), error)
    } finally {
      saving.value = false
    }
  }

  const discard = () => {
    clearSaveTimer()
    saveQueued.value = false
    if (saved.value) {
      draft.value = cloneSettings(saved.value)
    }
  }

  watch(draft, scheduleSave, { deep: true })

  return {
    saved,
    draft,
    capabilities,
    loading,
    saving,
    dirty,
    errors,
    valid,
    load,
    save,
    flush,
    reset,
    discard,
  }
})

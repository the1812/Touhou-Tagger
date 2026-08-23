import { defineStore } from 'pinia'
import { computed, ref, toRaw, watch } from 'vue'

import { getApi, type Capabilities, type Settings } from '../api'
import { t } from '../i18n'
import { useNotificationsStore } from './notifications'

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
  let saveQueued = false

  const dirty = computed(() => !settingsEqual(saved.value, draft.value))
  const errors = computed<Record<string, string>>(() => {
    const { value } = draft
    if (!value) {
      return {}
    }
    const next: Record<string, string> = {}
    if (!value.mp3MultiValueSeparator.trim()) {
      next.mp3MultiValueSeparator = t('validation.separatorRequired')
    }
    if (value.requestTimeoutSeconds < 1 || value.requestTimeoutSeconds > 300) {
      next.requestTimeoutSeconds = t('validation.requestTimeoutRange')
    }
    if (value.retryCount < 1 || value.retryCount > 10) {
      next.retryCount = t('validation.retryCountRange')
    }
    if (value.coverCompressionThresholdKb < 0) {
      next.coverCompressionThresholdKb = t('validation.coverThresholdNonNegative')
    }
    if (value.coverMaxEdge < 0) {
      next.coverMaxEdge = t('validation.coverMaxEdgeNonNegative')
    }
    if (value.writeLyricsMetadata && value.writeLrcFiles) {
      next.lyricDestination = t('validation.lyricDestinationConflict')
    }
    if (!value.mixedLyricSeparator.trim()) {
      next.mixedLyricSeparator = t('validation.mixedLyricSeparatorRequired')
    }
    if (value.lyricCacheSize < 1 || value.lyricCacheSize > 10000) {
      next.lyricCacheSize = t('validation.lyricCacheSizeRange')
    }
    if (
      capabilities.value &&
      !capabilities.value.sources.some(
        source => source.supportsSearch && source.value === value.defaultSource,
      )
    ) {
      next.defaultSource = t('validation.searchableSourceRequired')
    }
    return next
  })
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
      saveQueued = true
      return savePromise
    }

    const snapshot = cloneSettings(draft.value)
    saving.value = true
    saveQueued = false
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
        if (saveQueued) {
          saveQueued = false
          saveTimer = setTimeout(() => {
            saveTimer = undefined
            save()
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
      saveQueued = true
      return
    }
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      save()
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
    saveQueued = false
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

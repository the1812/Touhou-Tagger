import { defineStore } from 'pinia'
import { computed, ref, toRaw, watch } from 'vue'

import { getApi, type Capabilities, type Settings } from '../api'
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
      next.mp3MultiValueSeparator = '分隔符不能为空。'
    }
    if (value.requestTimeoutSeconds < 1 || value.requestTimeoutSeconds > 300) {
      next.requestTimeoutSeconds = '请求超时必须在 1 到 300 秒之间。'
    }
    if (value.retryCount < 1 || value.retryCount > 10) {
      next.retryCount = '重试次数必须在 1 到 10 之间。'
    }
    if (
      value.coverCompressionThresholdKb !== 0 &&
      (value.coverCompressionThresholdKb < 64 ||
        value.coverCompressionThresholdKb > 102400)
    ) {
      next.coverCompressionThresholdKb =
        '输入 0 可禁用压缩，否则阈值必须在 64 到 102400 KB 之间。'
    }
    if (
      (value.coverMaxEdge !== 0 && value.coverMaxEdge < 256) ||
      value.coverMaxEdge > 8192
    ) {
      next.coverMaxEdge = '输入 0 可禁用缩放，否则边长必须在 256 到 8192 像素之间。'
    }
    if (value.writeLyricsMetadata && value.writeLrcFiles) {
      next.lyricDestination = '歌词只能写入 metadata 或 LRC 其中一处。'
    }
    if (!value.mixedLyricSeparator.trim()) {
      next.mixedLyricSeparator = '混合歌词分隔符不能为空。'
    }
    if (value.lyricCacheSize < 1 || value.lyricCacheSize > 10000) {
      next.lyricCacheSize = '缓存数量必须在 1 到 10000 之间。'
    }
    if (
      capabilities.value &&
      !capabilities.value.sources.some(
        (source) => source.supportsSearch && source.value === value.defaultSource,
      )
    ) {
      next.defaultSource = '请选择支持搜索的数据源。'
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
        notifications.error('加载设置失败', error)
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

  const scheduleSave = () => {
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
      void save()
    }, autoSaveDelay)
  }

  const save = (): Promise<boolean> => {
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
        notifications.error('自动保存设置失败', error)
        return false
      } finally {
        saving.value = false
        savePromise = undefined
        if (saveQueued) {
          saveQueued = false
          scheduleSave()
        }
      }
    })()
    return savePromise
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
      notifications.success('已恢复默认设置', '默认设置已经保存。')
    } catch (error) {
      notifications.error('恢复默认设置失败', error)
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

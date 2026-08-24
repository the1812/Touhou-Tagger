import { computed, readonly, ref, watch } from 'vue'

const themeModes = ['system', 'light', 'dark'] as const

export type ThemeMode = (typeof themeModes)[number]

const storageKey = 'touhou-tagger-theme'
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
const themeMode = ref<ThemeMode>((localStorage.getItem(storageKey) as ThemeMode | null) ?? 'system')
const systemDark = ref(systemTheme.matches)

export const initializeThemeMode = () => {
  systemTheme.addEventListener('change', event => {
    systemDark.value = event.matches
  })

  watch(
    [themeMode, systemDark],
    () => {
      const dark = themeMode.value === 'dark' || (themeMode.value === 'system' && systemDark.value)
      document.documentElement.classList.toggle('app-dark', dark)
      localStorage.setItem(storageKey, themeMode.value)
    },
    { immediate: true },
  )
}

export const useThemeMode = () => {
  const nextThemeMode = computed(
    () => themeModes[(themeModes.indexOf(themeMode.value) + 1) % themeModes.length],
  )

  return {
    themeMode: readonly(themeMode),
    nextThemeMode,
    cycleThemeMode: () => {
      themeMode.value = nextThemeMode.value
    },
  }
}

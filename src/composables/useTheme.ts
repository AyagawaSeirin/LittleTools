import { computed, ref, watch } from 'vue'

const DEFAULT_COLOR = '#276b63'
const storedMode = localStorage.getItem('little-tools-mode')
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches

const isDark = ref(storedMode ? storedMode === 'dark' : prefersDark)
const primaryColor = ref(localStorage.getItem('little-tools-color') || DEFAULT_COLOR)

watch(isDark, (value) => {
  localStorage.setItem('little-tools-mode', value ? 'dark' : 'light')
  document.documentElement.dataset.theme = value ? 'dark' : 'light'
}, { immediate: true })

watch(primaryColor, (value) => {
  localStorage.setItem('little-tools-color', value)
  document.documentElement.style.setProperty('--primary-color', value)
}, { immediate: true })

export function useTheme() {
  return {
    isDark,
    primaryColor,
    themeLabel: computed(() => (isDark.value ? '切换为白天模式' : '切换为黑夜模式')),
    resetColor: () => { primaryColor.value = DEFAULT_COLOR },
  }
}

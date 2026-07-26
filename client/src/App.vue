<script setup>
import { computed, onMounted, watch } from 'vue'
import { ElConfigProvider } from 'element-plus'
import { useLocaleStore } from './stores/localeStore'
import { useThemeStore } from './stores/themeStore'
import AppLayout from './components/layout/AppLayout.vue'

const localeStore = useLocaleStore()
const themeStore = useThemeStore()

const currentLocale = computed(() => localeStore.elementPlusLocale)

// Watch for theme changes and update document class for Element Plus dark mode
watch(() => themeStore.isDarkMode, (isDark) => {
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}, { immediate: true })

// Initialize theme on mount
onMounted(() => {
  themeStore.setTheme(themeStore.isDarkMode)
})
</script>

<template>
  <el-config-provider :locale="currentLocale">
    <AppLayout />
  </el-config-provider>
</template>

<style>
/* Dark theme for Element Plus */
html.dark {
  color-scheme: dark;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--app-bg);
}

#app {
  width: 100%;
  height: 100vh;
}
</style>

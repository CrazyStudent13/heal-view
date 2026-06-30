import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const isDarkMode = ref(localStorage.getItem('theme') === 'dark');

  function setTheme(isDark) {
    isDarkMode.value = isDark;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    applyTheme();
  }

  function toggleTheme() {
    setTheme(!isDarkMode.value);
  }

  function applyTheme() {
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
  }

  // Watch for changes and apply theme
  watch(isDarkMode, () => {
    applyTheme();
  });

  // Initialize theme on load
  applyTheme();

  return {
    isDarkMode,
    setTheme,
    toggleTheme
  };
});

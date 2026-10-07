<template>
  <van-config-provider
    :theme="themeStore.isDarkMode ? 'dark' : 'light'"
    :theme-vars="themeVars"
    :theme-vars-dark="themeVarsDark"
  >
    <div class="mobile-layout">
      <main class="mobile-layout__main">
        <RouterView />
      </main>
    </div>
  </van-config-provider>
</template>

<script setup>
import { computed } from 'vue';
import { RouterView } from 'vue-router';
import { useThemeStore } from '@/stores/themeStore.js';

const themeStore = useThemeStore();

// 把 Vant 的主题变量映射到应用既有的设计令牌，做到「换控件、不换脸」。
// ConfigProvider 以行内样式下发这些变量，优先级高于 Vant 自带样式表。
const themeVars = computed(() => ({
  primaryColor: 'var(--primary-color)',
  successColor: 'var(--success-color)',
  dangerColor: 'var(--danger-color)',
  warningColor: 'var(--warning-color)',
  background: 'var(--app-bg)',
  background2: 'var(--card-bg)',
  background3: 'var(--card-bg)',
  textColor: 'var(--text-primary)',
  textColor2: 'var(--text-secondary)',
  textColor3: 'var(--text-tertiary)',
  borderColor: 'var(--card-border)',
  activeColor: 'var(--control-hover-bg)',
  cellBackground: 'var(--card-bg)',
  cellBorderColor: 'var(--card-border)',
  popupBackground: 'var(--card-bg)',
  cellFontSize: '15px',
  cellVerticalPadding: '12px',
  radiusMd: '8px',
  radiusLg: '12px'
}));

// 深色模式只需覆盖语义色，其余令牌由 .dark-theme 提供。
const themeVarsDark = computed(() => ({
  primaryColor: 'var(--primary-color)',
  successColor: 'var(--success-color)',
  dangerColor: 'var(--danger-color)',
  warningColor: 'var(--warning-color)'
}));
</script>

<style scoped lang="scss">
.mobile-layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--app-bg);
}

.mobile-layout__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
</style>

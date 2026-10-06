<template>
  <van-config-provider
    :theme="themeStore.isDarkMode ? 'dark' : 'light'"
    :theme-vars="themeVars"
    :theme-vars-dark="themeVarsDark"
  >
    <div class="mobile-layout">
      <header class="mobile-layout__header">
        <div class="mobile-layout__brand">
          <van-icon name="calendar-o" class="mobile-layout__brand-icon" />
          <span class="mobile-layout__brand-text">{{ t('mobile.appTitle') }}</span>
        </div>
        <van-button
          class="mobile-layout__action"
          icon="setting-o"
          round
          plain
          size="small"
          :aria-label="t('settings.title')"
          @click="settingsVisible = true"
        />
      </header>

      <main class="mobile-layout__main">
        <RouterView />
      </main>

      <van-popup v-model:show="settingsVisible" position="bottom" round safe-area-inset-bottom>
        <section class="settings-sheet">
          <header class="settings-sheet__header">
            <h3>{{ t('settings.title') }}</h3>
          </header>

          <div class="settings-group">
            <p class="settings-group__label">{{ t('settings.language') }}</p>
            <van-cell-group inset>
              <van-cell
                v-for="locale in localeStore.availableLocales"
                :key="locale.code"
                :title="t(locale.labelKey)"
                clickable
                :class="{ 'settings-cell--active': locale.code === localeStore.currentLocale }"
                @click="localeStore.setLocale(locale.code)"
              >
                <template #right-icon>
                  <van-icon
                    v-if="locale.code === localeStore.currentLocale"
                    name="success"
                    class="settings-cell__check"
                  />
                </template>
              </van-cell>
            </van-cell-group>
          </div>

          <div class="settings-group">
            <p class="settings-group__label">{{ t('settings.theme') }}</p>
            <van-cell-group inset>
              <van-cell :title="t('settings.dark')" center>
                <template #right-icon>
                  <van-switch
                    :model-value="themeStore.isDarkMode"
                    size="22px"
                    @update:model-value="themeStore.setTheme"
                  />
                </template>
              </van-cell>
            </van-cell-group>
          </div>

          <p class="settings-sheet__note">{{ t('mobile.aboutNote') }}</p>

          <van-button
            v-if="authStore.canLogout"
            class="settings-sheet__logout"
            block
            :loading="authStore.loading"
            @click="handleLogout"
          >
            {{ t('auth.logout') }}
          </van-button>
        </section>
      </van-popup>
    </div>
  </van-config-provider>
</template>

<script setup>
import { computed, ref } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { useLocaleStore } from '@/stores/localeStore.js';
import { useThemeStore } from '@/stores/themeStore.js';
import { useAuthStore } from '@/stores/authStore.js';

const { t } = useLocaleStore();
const localeStore = useLocaleStore();
const themeStore = useThemeStore();
const authStore = useAuthStore();
const router = useRouter();
const settingsVisible = ref(false);

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

async function handleLogout() {
  await authStore.logout();
  settingsVisible.value = false;
  router.push({ name: 'login' });
}
</script>

<style scoped lang="scss">
.mobile-layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--app-bg);
}

.mobile-layout__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--card-border);
}

.mobile-layout__brand {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.mobile-layout__brand-icon {
  color: var(--primary-color);
  font-size: 18px;
}

.mobile-layout__brand-text {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-layout__action {
  flex: none;
  width: 40px;
  height: 40px;
}

.settings-sheet {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 20px;
}

.settings-sheet__header {
  padding: 0 16px;
}

.settings-sheet__header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 600;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-group__label {
  margin: 0;
  padding: 0 16px;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: left;
}

.settings-cell--active :deep(.van-cell__title) {
  color: var(--primary-color);
  font-weight: 500;
}

.settings-cell__check {
  color: var(--primary-color);
  font-size: 18px;
}

.settings-sheet__note {
  margin: 0;
  padding: 0 16px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.6;
  text-align: left;
}

.settings-sheet__logout {
  width: calc(100% - 32px);
  margin: 0 16px;
}
</style>

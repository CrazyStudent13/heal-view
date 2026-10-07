<template>
  <div class="mobile-settings">
    <van-nav-bar class="mobile-settings__nav" :title="t('settings.title')" left-arrow @click-left="goBack" />

    <main class="mobile-settings__body">
      <header class="settings-intro">
        <div class="settings-intro__icon" aria-hidden="true">
          <van-icon name="setting-o" />
        </div>
        <div class="settings-intro__content">
          <strong>{{ t('settings.productName') }}</strong>
          <p>{{ t('settings.description') }}</p>
        </div>
      </header>

      <section class="settings-section">
        <header class="settings-section__header">
          <h2 class="settings-section__title">{{ t('settings.language') }}</h2>
          <p class="settings-section__description">{{ t('settings.languageDescription') }}</p>
        </header>
        <van-cell-group inset class="settings-card">
          <van-cell
            v-for="locale in localeStore.availableLocales"
            :key="locale.code"
            :title="t(locale.labelKey)"
            center
            clickable
            :class="{ 'settings-cell--active': locale.code === localeStore.currentLocale }"
            @click="localeStore.setLocale(locale.code)"
          >
            <template #icon>
              <span class="settings-cell__locale" aria-hidden="true">{{ locale.code === 'zh-CN' ? '中' : 'EN' }}</span>
            </template>
            <template #right-icon>
              <van-icon v-if="locale.code === localeStore.currentLocale" name="success" class="settings-cell__check" />
            </template>
          </van-cell>
        </van-cell-group>
      </section>

      <section class="settings-section">
        <header class="settings-section__header">
          <h2 class="settings-section__title">{{ t('settings.theme') }}</h2>
          <p class="settings-section__description">{{ t('settings.themeDescription') }}</p>
        </header>
        <van-cell-group inset class="settings-card">
          <van-cell
            :title="t('settings.theme')"
            :label="themeStore.isDarkMode ? t('settings.dark') : t('settings.light')"
            center
          >
            <template #icon>
              <van-icon name="bulb-o" class="settings-cell__icon" aria-hidden="true" />
            </template>
            <template #right-icon>
              <van-switch :model-value="themeStore.isDarkMode" size="22px" @update:model-value="themeStore.setTheme" />
            </template>
          </van-cell>
        </van-cell-group>
      </section>

      <section class="settings-section">
        <header class="settings-section__header">
          <h2 class="settings-section__title">{{ t('settings.about') }}</h2>
          <p class="settings-section__description">{{ t('settings.aboutDescription') }}</p>
        </header>
        <van-cell-group inset class="settings-card">
          <van-cell :title="t('settings.productName')" :label="t('mobile.aboutNote')" center>
            <template #icon>
              <van-icon name="info-o" class="settings-cell__icon" aria-hidden="true" />
            </template>
          </van-cell>
        </van-cell-group>
      </section>

      <section v-if="authStore.canLogout" class="settings-section settings-section--account">
        <header class="settings-section__header">
          <h2 class="settings-section__title">{{ t('settings.account') }}</h2>
          <p class="settings-section__description">{{ t('settings.accountDescription') }}</p>
        </header>
        <van-cell-group inset class="settings-card settings-card--account">
          <van-cell :title="t('auth.accessProtection')" :label="t('settings.logoutDescription')" center>
            <template #icon>
              <van-icon name="user-o" class="settings-cell__icon" aria-hidden="true" />
            </template>
          </van-cell>
          <div class="settings-account__action">
            <van-button
              block
              plain
              type="danger"
              :loading="authStore.loading"
              :loading-text="t('settings.loggingOut')"
              @click="handleLogout"
            >
              {{ t('auth.logout') }}
            </van-button>
            <p v-if="authStore.error" class="settings-account__error" role="alert">{{ authStore.error }}</p>
          </div>
        </van-cell-group>
      </section>
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useLocaleStore } from '@/stores/localeStore.js';
import { useThemeStore } from '@/stores/themeStore.js';
import { useAuthStore } from '@/stores/authStore.js';

const router = useRouter();
const localeStore = useLocaleStore();
const themeStore = useThemeStore();
const authStore = useAuthStore();
const { t } = localeStore;

function goBack() {
  router.push({ name: 'mobile-today' });
}

async function handleLogout() {
  try {
    await authStore.logout();
    router.push({ name: 'login' });
  } catch {
    // The store keeps the translated error for the account section to display.
  }
}
</script>

<style scoped lang="scss">
.mobile-settings {
  min-height: 100dvh;
  background: var(--app-bg);
}

.mobile-settings__nav {
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 1px solid var(--card-border);
}

.mobile-settings__body {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px 0 calc(28px + env(safe-area-inset-bottom));
}

.settings-intro {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 16px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, var(--card-border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--primary-color) 7%, var(--card-bg));
}

.settings-intro__icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  place-items: center;
  border-radius: 10px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 15%, var(--card-bg));
  font-size: 22px;
}

.settings-intro__content {
  min-width: 0;
}

.settings-intro__content strong {
  display: block;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
}

.settings-intro__content p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-section__header {
  padding: 0 16px;
}

.settings-section__title {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
}

.settings-section__description {
  margin: 3px 0 0;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.settings-card {
  overflow: hidden;
  border: 1px solid var(--card-border);
}

.settings-cell__icon {
  margin-right: 10px;
  color: var(--text-secondary);
  font-size: 19px;
}

.settings-cell__locale {
  display: inline-grid;
  width: 22px;
  height: 22px;
  margin-right: 10px;
  place-items: center;
  border-radius: 6px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, var(--card-bg));
  font-size: 11px;
  font-weight: 600;
}

.settings-cell--active :deep(.van-cell__title) {
  color: var(--primary-color);
  font-weight: 500;
}

.settings-cell__check {
  color: var(--primary-color);
  font-size: 18px;
}

.settings-card--account {
  padding-bottom: 12px;
}

.settings-account__action {
  padding: 0 12px;
}

.settings-account__error {
  margin: 8px 0 0;
  color: var(--danger-color);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}
</style>

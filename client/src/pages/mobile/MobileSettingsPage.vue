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
            :title="t('settings.language')"
            :value="currentLocaleLabel"
            center
            is-link
            clickable
            @click="localePickerVisible = true"
          >
            <template #icon>
              <span class="settings-cell__locale" aria-hidden="true">{{ localeCodeLabel }}</span>
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
            :value="currentThemeLabel"
            center
            is-link
            clickable
            @click="themePickerVisible = true"
          >
            <template #icon>
              <van-icon name="bulb-o" class="settings-cell__icon" aria-hidden="true" />
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

    <van-popup v-model:show="localePickerVisible" position="bottom" round>
      <van-picker
        :model-value="localePickerValue"
        :columns="localePickerOptions"
        :title="t('settings.language')"
        @confirm="confirmLocale"
        @cancel="localePickerVisible = false"
      />
    </van-popup>

    <van-popup v-model:show="themePickerVisible" position="bottom" round>
      <van-picker
        :model-value="themePickerValue"
        :columns="themePickerOptions"
        :title="t('settings.theme')"
        @confirm="confirmTheme"
        @cancel="themePickerVisible = false"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLocaleStore } from '@/stores/localeStore.js';
import { useThemeStore } from '@/stores/themeStore.js';
import { useAuthStore } from '@/stores/authStore.js';

const router = useRouter();
const localeStore = useLocaleStore();
const themeStore = useThemeStore();
const authStore = useAuthStore();
const { t } = localeStore;
const localePickerVisible = ref(false);
const themePickerVisible = ref(false);

const localePickerOptions = computed(() => {
  localeStore.currentLocale;
  return localeStore.availableLocales.map((locale) => ({
    text: t(locale.labelKey),
    value: locale.code
  }));
});
const localePickerValue = computed(() => [localeStore.currentLocale]);
const currentLocaleLabel = computed(() => {
  const current = localeStore.availableLocales.find((locale) => locale.code === localeStore.currentLocale);
  return current ? t(current.labelKey) : localeStore.currentLocale;
});
const localeCodeLabel = computed(() => (localeStore.currentLocale === 'zh-CN' ? '中' : 'EN'));
const themePickerOptions = computed(() => [
  { text: t('settings.light'), value: 'light' },
  { text: t('settings.dark'), value: 'dark' }
]);
const themePickerValue = computed(() => [themeStore.isDarkMode ? 'dark' : 'light']);
const currentThemeLabel = computed(() => (themeStore.isDarkMode ? t('settings.dark') : t('settings.light')));

function goBack() {
  router.push({ name: 'mobile-today' });
}

function confirmLocale({ selectedValues }) {
  const nextLocale = selectedValues?.[0];
  if (nextLocale) localeStore.setLocale(nextLocale);
  localePickerVisible.value = false;
}

function confirmTheme({ selectedValues }) {
  const nextTheme = selectedValues?.[0];
  if (nextTheme) themeStore.setTheme(nextTheme === 'dark');
  themePickerVisible.value = false;
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
  text-align: left;
}

.settings-card {
  overflow: hidden;
  border: 1px solid var(--card-border);
}

.settings-card :deep(.van-cell__title) {
  text-align: left;
}

.settings-cell__icon {
  margin-right: 8px;
  color: var(--text-secondary);
  font-size: 19px;
}

.settings-cell__locale {
  display: inline-grid;
  width: 22px;
  height: 22px;
  margin-right: 8px;
  place-items: center;
  border-radius: 6px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, var(--card-bg));
  font-size: 11px;
  font-weight: 600;
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

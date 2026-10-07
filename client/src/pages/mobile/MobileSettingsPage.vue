<template>
  <div class="mobile-settings">
    <van-nav-bar class="mobile-settings__nav" :title="t('settings.title')" left-arrow @click-left="goBack" />

    <main class="mobile-settings__body">
      <section class="settings-section">
        <h2 class="settings-section__title">{{ t('settings.language') }}</h2>
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
              <van-icon v-if="locale.code === localeStore.currentLocale" name="success" class="settings-cell__check" />
            </template>
          </van-cell>
        </van-cell-group>
      </section>

      <section class="settings-section">
        <h2 class="settings-section__title">{{ t('settings.theme') }}</h2>
        <van-cell-group inset>
          <van-cell :title="t('settings.dark')" center>
            <template #right-icon>
              <van-switch :model-value="themeStore.isDarkMode" size="22px" @update:model-value="themeStore.setTheme" />
            </template>
          </van-cell>
        </van-cell-group>
      </section>

      <section class="settings-section settings-section--about">
        <h2 class="settings-section__title">{{ t('settings.about') }}</h2>
        <p class="settings-section__note">{{ t('mobile.aboutNote') }}</p>
      </section>

      <van-button
        v-if="authStore.canLogout"
        class="mobile-settings__logout"
        block
        :loading="authStore.loading"
        @click="handleLogout"
      >
        {{ t('auth.logout') }}
      </van-button>
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
  await authStore.logout();
  router.push({ name: 'login' });
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
  gap: 20px;
  padding: 20px 0 calc(24px + env(safe-area-inset-bottom));
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-section__title {
  margin: 0;
  padding: 0 16px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
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

.settings-section--about {
  gap: 6px;
}

.settings-section__note {
  margin: 0;
  padding: 0 16px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.6;
  text-align: left;
}

.mobile-settings__logout {
  width: calc(100% - 32px);
  margin: 4px 16px 0;
}
</style>

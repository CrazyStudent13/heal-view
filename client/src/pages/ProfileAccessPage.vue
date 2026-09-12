<template>
  <div class="settings-page">
    <div class="settings-card">
      <AsyncState
        v-if="settingsLoading || settingsError"
        :loading="settingsLoading"
        :error="settingsError"
        :show-retry="Boolean(settingsError)"
        @retry="loadSettings"
      />

      <template v-else>
      <section class="protection-row">
        <div class="protection-copy">
          <div class="protection-title-row">
            <span class="protection-label">{{ t('auth.accessProtection') }}</span>
            <span class="protection-status" :class="{ enabled: enabled }">
              {{ enabled ? t('auth.enabled') : t('auth.disabled') }}
            </span>
          </div>
          <p>{{ t('auth.accessProtectionDescription') }}</p>
        </div>
        <el-switch v-model="enabled" :disabled="auth.loading" />
      </section>

      <el-divider />

      <section class="password-section">
        <div class="section-heading">
          <h3>{{ t('auth.newPassword') }}</h3>
        </div>

        <el-form label-position="top" class="password-form">
          <el-form-item :label="t('auth.newPassword')">
            <el-input
              v-model="password"
              type="password"
              show-password
              autocomplete="new-password"
              :disabled="auth.loading"
            />
          </el-form-item>
          <el-form-item :label="t('auth.confirmPassword')">
            <el-input
              v-model="confirmPassword"
              type="password"
              show-password
              autocomplete="new-password"
              :disabled="auth.loading"
            />
          </el-form-item>
        </el-form>
      </section>

      <el-alert
        v-if="auth.error"
        class="settings-error"
        type="error"
        :title="auth.error"
        :closable="false"
        show-icon
      />

      <div class="settings-actions">
        <el-button type="primary" :loading="auth.loading" @click="save">
          {{ t('auth.save') }}
        </el-button>
        <el-button v-if="auth.enabled" :disabled="auth.loading" @click="signOut">
          {{ t('auth.loggedOut') }}
        </el-button>
      </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { useLocaleStore } from '../stores/localeStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { useAsyncRequest } from '../composables/useAsyncRequest.js';
import AsyncState from '../components/common/AsyncState.vue';

const localeStore = useLocaleStore();
const auth = useAuthStore();
const router = useRouter();
const { t } = localeStore;
const enabled = ref(false);
const password = ref('');
const confirmPassword = ref('');
const settingsState = useAsyncRequest({ fallbackError: t('auth.settingsLoadFailed') });
const { loading: settingsLoading, error: settingsError } = settingsState;
let pageActive = true;

async function loadSettings() {
  auth.error = '';
  await settingsState.run(async () => {
    const settings = await auth.fetchSettings();
    if (pageActive) enabled.value = settings.enabled;
    return settings;
  }, { fallback: null });
}

onMounted(loadSettings);

onUnmounted(() => {
  pageActive = false;
});

async function save() {
  auth.error = '';
  if (enabled.value && !auth.configured && !password.value) {
    auth.error = t('auth.passwordRequiredToEnable');
    return;
  }
  if (password.value !== confirmPassword.value) {
    auth.error = t('auth.passwordMismatch');
    return;
  }

  try {
    await auth.updateSettings({ enabled: enabled.value, password: password.value });
    password.value = '';
    confirmPassword.value = '';
    ElMessage.success(t('auth.saved'));
  } catch {
    // The store exposes the normalized error for the page-level alert.
  }
}

async function signOut() {
  try {
    await auth.logout();
    ElMessage.success(t('auth.loggedOut'));
    router.push('/login');
  } catch {
    // The store exposes the normalized error for the page-level alert.
  }
}
</script>

<style scoped lang="scss">
.settings-page {
  width: 100%;
  margin: 0;
  text-align: left;
}

.settings-card {
  position: relative;
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  padding: 24px;
  text-align: left;
}

.settings-card :deep(.async-state) {
  min-height: 280px;
}

.protection-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  box-sizing: border-box;
  gap: 16px;
}

.protection-copy {
  min-width: 0;
}

.protection-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.protection-copy p {
  margin: 5px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.protection-label {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
}

.protection-status {
  padding: 3px 8px;
  border-radius: 4px;
  color: var(--text-secondary);
  background: var(--app-bg);
  font-size: 12px;
}

.protection-status.enabled {
  color: var(--success-color);
  background: rgba(103, 194, 58, 0.12);
}

.password-section {
  max-width: 460px;
}

.section-heading {
  margin-bottom: 16px;
}

.section-heading h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
}

.password-form {
  width: 440px;
  max-width: 100%;
}

.password-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.settings-error {
  max-width: 460px;
  margin-top: 4px;
}

.settings-actions {
  display: flex;
  gap: 12px;
  margin-top: 22px;
}
</style>

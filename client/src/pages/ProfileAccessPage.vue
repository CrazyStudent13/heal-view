<template>
  <div class="settings-page">
    <header class="page-heading">
      <div class="page-heading-icon">
        <el-icon><Lock /></el-icon>
      </div>
      <h2>{{ t('auth.accessProtection') }}</h2>
    </header>

    <el-card class="settings-card" shadow="never">
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
        <el-switch v-model="enabled" />
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
            />
          </el-form-item>
          <el-form-item :label="t('auth.confirmPassword')">
            <el-input
              v-model="confirmPassword"
              type="password"
              show-password
              autocomplete="new-password"
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
        <el-button v-if="auth.enabled" @click="signOut">
          {{ t('auth.loggedOut') }}
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Lock } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { useLocaleStore } from '../stores/localeStore.js';
import { useAuthStore } from '../stores/authStore.js';

const localeStore = useLocaleStore();
const auth = useAuthStore();
const router = useRouter();
const { t } = localeStore;
const enabled = ref(false);
const password = ref('');
const confirmPassword = ref('');

onMounted(async () => {
  const settings = await auth.fetchSettings();
  enabled.value = settings.enabled;
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

  await auth.updateSettings({ enabled: enabled.value, password: password.value });
  password.value = '';
  confirmPassword.value = '';
  ElMessage.success(t('auth.saved'));
}

async function signOut() {
  await auth.logout();
  ElMessage.success(t('auth.loggedOut'));
  router.push('/login');
}
</script>

<style scoped lang="scss">
.settings-page {
  width: min(100%, 720px);
  margin: 0;
  text-align: left;
}

.page-heading {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  width: 100%;
  margin-bottom: 16px;
  padding: 0 2px;
  text-align: left;
}

.page-heading-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--primary-color);
  background: var(--primary-light);
  font-size: 17px;
}

.page-heading h2 {
  display: block;
  margin: 0;
  color: var(--text-primary);
  font-size: 22px;
  text-align: left;
}

.settings-card {
  width: 100%;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  text-align: left;
}

.settings-card :deep(.el-card__body) {
  padding: 24px;
}

.protection-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

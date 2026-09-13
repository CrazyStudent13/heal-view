<template>
  <main class="login-page">
    <el-card class="login-card" shadow="never">
      <el-radio-group
        v-model="currentLanguage"
        class="language-switch"
        size="small"
        :aria-label="t('settings.language')"
      >
        <el-radio-button
          v-for="locale in localeStore.availableLocales"
          :key="locale.code"
          :value="locale.code"
        >
          {{ locale.code === 'zh-CN' ? 'ZH' : 'EN' }}
        </el-radio-button>
      </el-radio-group>

      <div class="login-heading">
        <p class="brand-name">Heal View</p>
      </div>

      <el-form
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <el-form-item :error="auth.error">
          <el-input
            ref="passwordInput"
            v-model="password"
            type="password"
            show-password
            autocomplete="current-password"
            :placeholder="t('auth.passwordPlaceholder')"
            :disabled="auth.loading"
            :aria-invalid="Boolean(auth.error)"
            @input="clearError"
          >
            <template #prefix>
              <el-icon aria-hidden="true"><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-button
          type="primary"
          native-type="submit"
          :loading="auth.loading"
          :disabled="!password"
          class="login-button"
        >
          {{ t('auth.enter') }}
        </el-button>
        <el-checkbox v-model="rememberLogin" class="remember-login">
          {{ t('auth.rememberLogin') }}
        </el-checkbox>
      </el-form>

      <el-alert
        class="forgot-password-tip"
        type="info"
        :closable="false"
        show-icon
        :title="t('auth.forgotPassword')"
      >
        <template #default>
          <div class="forgot-password-tip__content">
            <p>{{ t('auth.resetCommandHint') }}</p>
            <div class="forgot-password-tip__command">
              <code>{{ RESET_COMMAND }}</code>
              <el-tooltip :content="t('auth.copyCommand')" placement="top">
                <el-button
                  circle
                  text
                  size="small"
                  :icon="copied ? SuccessFilled : CopyDocument"
                  :type="copied ? 'success' : 'info'"
                  :aria-label="t('auth.copyCommand')"
                  :aria-pressed="copied"
                  @click="copyResetCommand"
                />
              </el-tooltip>
            </div>
          </div>
        </template>
      </el-alert>
    </el-card>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { CopyDocument, Lock, SuccessFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import { useAuthStore } from '@/stores/authStore.js';

const localeStore = useLocaleStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const password = ref('');
const rememberLogin = ref(true);
const passwordInput = ref(null);
const copied = ref(false);
let copiedResetTimer = null;
const { t } = localeStore;
const RESET_COMMAND = 'pnpm reset-access-password';

const currentLanguage = computed({
  get: () => localeStore.currentLocale,
  set: (value) => localeStore.setLocale(value)
});

function clearError() {
  if (auth.error) auth.error = '';
}

async function handleLogin() {
  if (auth.loading) return;
  if (!password.value) {
    auth.error = t('auth.passwordRequired');
    return;
  }
  if (await auth.login(password.value, rememberLogin.value)) {
    auth.error = '';
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    router.replace(redirect);
  }
}

async function copyResetCommand() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(RESET_COMMAND);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = RESET_COMMAND;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copiedSuccessfully = document.execCommand('copy');
      textarea.remove();
      if (!copiedSuccessfully) throw new Error('Clipboard fallback failed');
    }
    copied.value = true;
    ElMessage.success(t('auth.commandCopied'));
    clearTimeout(copiedResetTimer);
    copiedResetTimer = setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch {
    copied.value = false;
    ElMessage.error(t('auth.commandCopyFailed'));
  }
}

onMounted(() => {
  passwordInput.value?.focus?.();
});

onBeforeUnmount(() => {
  clearTimeout(copiedResetTimer);
});
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--app-bg);
}

.login-card {
  position: relative;
  width: min(100%, 400px);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--card-bg);
  box-shadow: 0 12px 32px rgba(31, 41, 55, 0.07);
}

.dark-theme .login-card {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}

.language-switch {
  position: absolute;
  top: 20px;
  right: 20px;
}

.language-switch :deep(.el-radio-button__inner) {
  padding: 5px 10px;
}

.login-heading {
  margin: 4px 72px 24px;
  text-align: center;
}

.brand-name {
  margin: 0;
  color: var(--text-primary);
  font-size: 21px;
  font-weight: 600;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.login-form :deep(.el-input__wrapper) {
  position: relative;
  min-height: 44px;
  padding: 1px 44px;
}

.login-form :deep(.el-input__inner) {
  font-size: 15px;
  padding-left: 0;
}

.login-button {
  width: 100%;
  min-height: 44px;
  font-size: 15px;
}

.remember-login {
  display: flex;
  justify-content: flex-start;
  margin: 10px 0 0;
}

.forgot-password-tip {
  margin-top: 26px;
}

.forgot-password-tip :deep(.el-alert__content) {
  text-align: left;
}

.forgot-password-tip__content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.forgot-password-tip__content p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.forgot-password-tip__command {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  line-height: 1.5;
}

.forgot-password-tip__command code {
  padding: 2px 6px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.forgot-password-tip__command :deep(.el-button) {
  flex: none;
}

.login-form :deep(.el-input__prefix),
.login-form :deep(.el-input__suffix) {
  position: absolute;
  top: 50%;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  transform: translateY(-50%);
}

.login-form :deep(.el-input__prefix) {
  left: 16px;
  width: 18px;
  height: 18px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.login-form :deep(.el-input__prefix-inner),
.login-form :deep(.el-input__suffix-inner),
.login-form :deep(.el-input__suffix-inner > *) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-form :deep(.el-input__prefix-inner) {
  width: 18px;
  height: 18px;
}

.login-form :deep(.el-input__prefix .el-icon) {
  font-size: 18px;
}

.login-form :deep(.el-input__suffix) {
  right: 14px;
  width: 22px;
  height: 22px;
}

.login-form :deep(.el-input__suffix-inner),
.login-form :deep(.el-input__suffix-inner > *) {
  width: 22px;
  height: 22px;
}

@media (max-width: 640px) {
  .login-page {
    padding: 16px;
  }

  .language-switch {
    top: 16px;
    right: 16px;
  }

  .login-heading {
    margin-right: 68px;
    margin-left: 68px;
  }
}
</style>

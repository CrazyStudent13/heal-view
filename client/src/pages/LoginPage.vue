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
          :label="locale.code"
        >
          {{ locale.code === 'zh-CN' ? '中' : 'EN' }}
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
            clearable
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
      </el-form>

      <el-alert
        class="forgot-password-tip"
        type="info"
        :closable="false"
        show-icon
        :title="t('auth.forgotPassword')"
      >
        <template #default>
          <span class="forgot-password-tip__command">{{ t('auth.resetCommand') }}</span>
        </template>
      </el-alert>
    </el-card>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Lock } from '@element-plus/icons-vue';
import { useLocaleStore } from '../stores/localeStore.js';
import { useAuthStore } from '../stores/authStore.js';

const localeStore = useLocaleStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const password = ref('');
const passwordInput = ref(null);
const { t } = localeStore;

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
  if (await auth.login(password.value)) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    router.replace(redirect);
  }
}

onMounted(() => {
  passwordInput.value?.focus?.();
});
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  position: relative;
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

.login-form :deep(.el-input__prefix) {
  color: var(--text-tertiary);
}

.login-form :deep(.el-input__wrapper) {
  min-height: 44px;
  padding: 1px 14px;
}

.login-form :deep(.el-input__inner) {
  font-size: 15px;
}

.login-button {
  width: 100%;
  min-height: 44px;
  font-size: 15px;
}

.forgot-password-tip {
  margin-top: 26px;
}

.forgot-password-tip__command {
  display: block;
  line-height: 1.5;
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

<template>
  <main class="login-page">
    <el-card class="login-card" shadow="never">
      <div class="login-heading">
        <el-icon><Lock /></el-icon>
        <div>
          <h1>{{ t('auth.title') }}</h1>
          <p>{{ t('auth.description') }}</p>
        </div>
      </div>

      <el-form @submit.prevent="handleLogin">
        <el-form-item :error="auth.error">
          <el-input
            v-model="password"
            type="password"
            show-password
            autocomplete="current-password"
            :placeholder="t('auth.passwordPlaceholder')"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="auth.loading" class="login-button">
          {{ t('auth.enter') }}
        </el-button>
      </el-form>

      <el-alert
        class="forgot-password-tip"
        type="info"
        :closable="false"
        show-icon
        :title="t('auth.forgotPassword')"
        :description="t('auth.resetCommand')"
      />
    </el-card>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Lock } from '@element-plus/icons-vue';
import { useLocaleStore } from '../stores/localeStore.js';
import { useAuthStore } from '../stores/authStore.js';

const localeStore = useLocaleStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const password = ref('');
const { t } = localeStore;

async function handleLogin() {
  if (!password.value) {
    auth.error = t('auth.passwordRequired');
    return;
  }
  if (await auth.login(password.value)) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    router.replace(redirect);
  }
}
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--app-bg);
}

.login-card {
  width: min(100%, 420px);
  border: 1px solid var(--card-border);
  border-radius: 8px;
}

.login-heading {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 28px;
}

.login-heading > .el-icon {
  flex: none;
  margin-top: 3px;
  font-size: 28px;
  color: var(--primary-color);
}

h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 24px;
}

p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.login-button {
  width: 100%;
}

.forgot-password-tip {
  margin-top: 24px;
}
</style>

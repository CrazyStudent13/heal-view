<template>
  <div class="top-navbar">
    <nav class="primary-nav" :aria-label="t('nav.mainNavigation')">
      <button
        v-for="item in navItems"
        :key="item.path"
        :class="['nav-button', { active: isActive(item) }]"
        type="button"
        :aria-current="isActive(item) ? 'page' : undefined"
        @click="navigate(item.path)"
      >
        <el-icon><component :is="item.icon" /></el-icon>
        <span>{{ t(item.labelKey) }}</span>
      </button>
    </nav>

    <div class="nav-spacer"></div>

    <!-- Import and settings actions -->
    <el-tooltip :content="t('nav.import')" placement="bottom">
      <el-button
        :icon="UploadFilled"
        circle
        size="large"
        :class="['nav-circle-button', { active: route.path === '/import' }]"
        :aria-label="t('nav.import')"
        @click="navigate('/import')"
      />
    </el-tooltip>

    <el-button 
      :icon="Setting" 
      circle 
      size="large"
      class="nav-circle-button"
      :aria-label="t('settings.title')"
      @click="$emit('open-settings')"
    />

    <span v-show="auth.canLogout" class="logout-action">
      <el-tooltip :content="t('auth.logout')" placement="bottom">
        <el-button
          :icon="SwitchButton"
          circle
          size="large"
          class="nav-circle-button logout-button"
          :loading="auth.loading"
          :aria-label="t('auth.logout')"
          @click="handleLogout"
        />
      </el-tooltip>
    </span>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { DataLine, Setting, SwitchButton, UploadFilled, Calendar, Document, UserFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore';
import { useAuthStore } from '../../stores/authStore.js';

const localeStore = useLocaleStore();

// Translation function
function t(key) {
  return localeStore.t(key);
}

defineEmits(['open-settings']);
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const navItems = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: DataLine },
  { path: '/plans', labelKey: 'nav.plans', icon: Calendar },
  { path: '/reports/weekly', labelKey: 'nav.reports', icon: Document },
  { path: '/profile', labelKey: 'profile.title', icon: UserFilled }
];

function isActive(item) {
  if (item.path === '/reports/weekly') {
    return route.path.startsWith('/reports');
  }
  if (item.path === '/profile') {
    return route.path.startsWith('/profile');
  }
  return route.path === item.path;
}

function navigate(path) {
  router.push(path);
}

async function handleLogout() {
  if (auth.loading) return;

  try {
    await auth.logout();
    await router.replace({
      name: 'login',
      query: { redirect: route.fullPath }
    });
  } catch {
    ElMessage.error(auth.error || t('auth.logoutFailed'));
  }
}

onMounted(() => {
  auth.fetchStatus().catch(() => {
    // Route guards handle auth failures; the navbar only needs best-effort visibility sync.
  });
});

</script>

<style scoped lang="scss">
.top-navbar {
  background: var(--card-bg);
  border-bottom: 1px solid var(--card-border);
  min-height: 78px;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  box-shadow: var(--card-shadow);
}

.primary-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-spacer {
  flex: 1 1 auto;
}

.nav-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.nav-button:hover,
.nav-button.active {
  border-color: var(--primary-color);
  background: var(--primary-light);
  color: var(--primary-color);
}

.nav-button :deep(.el-icon) {
  font-size: 17px;
}

.nav-circle-button {
  width: 48px;
  height: 48px;
  border-color: var(--card-border);
  color: var(--text-secondary);
}

.nav-circle-button:hover,
.nav-circle-button.active {
  border-color: var(--primary-color);
  background: var(--primary-light);
  color: var(--primary-color);
}

.logout-action {
  display: inline-flex;
  align-items: center;
}

.logout-button {
  color: var(--text-secondary);
}

.logout-button:hover {
  border-color: var(--danger-color);
  background: var(--danger-light);
  color: var(--danger-color);
}

@media (max-width: 600px) {
  .top-navbar {
    gap: 10px;
    min-height: auto;
    padding: 12px;
  }

  .primary-nav {
    width: 100%;
    overflow-x: auto;
  }

  .logout-button {
    margin-left: auto;
  }
}
</style>


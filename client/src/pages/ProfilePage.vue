<template>
  <PageContainer class="profile-page" full-height content-width="none">
    <div class="profile-layout">
      <aside class="profile-sidebar page-surface-card">
        <div class="profile-heading page-surface-header">
          <div class="profile-icon">
            <el-icon><UserFilled /></el-icon>
          </div>
          <div>
            <h1>{{ t('profile.title') }}</h1>
          </div>
        </div>

        <nav class="profile-nav" :aria-label="t('profile.title')">
          <RouterLink
            v-for="item in menuItems"
            :key="item.path"
            :to="item.path"
            class="profile-nav-item"
            :class="{ active: route.path === item.path }"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ t(item.label) }}</span>
          </RouterLink>
        </nav>
      </aside>

      <main class="profile-content page-surface-card">
        <RouterView />
      </main>
    </div>
  </PageContainer>
</template>

<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { InfoFilled, Lock, UserFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import PageContainer from '@/components/common/PageContainer.vue';

const localeStore = useLocaleStore();
const { t } = localeStore;
const route = useRoute();

const menuItems = [
  { path: '/profile/access', label: 'profile.access', icon: Lock },
  { path: '/profile/about', label: 'profile.about', icon: InfoFilled }
];
</script>

<style lang="scss">
.profile-page {
  padding: 16px;
}

.profile-layout {
  display: flex;
  flex: 1;
  width: 100%;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.profile-sidebar,
.profile-content {
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.profile-sidebar {
  width: 320px;
  flex: 0 0 320px;
  padding: 0 12px 20px;
}

.profile-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  height: 64px;
  box-sizing: border-box;
  padding: 0 8px;
}

.profile-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 8px;
  color: var(--primary-color);
  background: var(--primary-light);
  font-size: 20px;
}

.profile-heading h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 20px;
}

.profile-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 16px;
}

.profile-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 14px;
  text-decoration: none;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.profile-nav-item:hover,
.profile-nav-item.active {
  color: var(--primary-color);
  background: var(--primary-light);
}

.profile-content {
  flex: 1 1 auto;
  min-width: 0;
  padding: 8px 16px 24px;
}

@media (max-width: 640px) {
  .profile-page {
    height: auto;
    min-height: 100%;
    overflow: visible;
    padding: 12px;
  }

  .profile-layout {
    flex-direction: column;
    height: auto;
  }

  .profile-sidebar {
    width: 100%;
    flex: none;
    height: auto;
    overflow: visible;
  }

  .profile-content {
    height: auto;
    min-height: 360px;
    overflow: visible;
    padding: 8px 12px 20px;
  }

  .profile-nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .profile-nav-item {
    min-width: 0;
  }
}
</style>

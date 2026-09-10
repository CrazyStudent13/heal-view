<template>
  <div class="top-navbar">
    <nav class="primary-nav">
      <button
        v-for="item in navItems"
        :key="item.path"
        :class="['nav-button', { active: isActive(item) }]"
        type="button"
        @click="navigate(item.path)"
      >
        <el-icon><component :is="item.icon" /></el-icon>
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div style="flex: 1"></div>

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
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';
import { DataLine, Setting, UploadFilled, Calendar, Document, UserFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore';

const localeStore = useLocaleStore();

// Translation function
function t(key) {
  return localeStore.t(key);
}

const emit = defineEmits(['update:viewMode', 'open-settings']);
const route = useRoute();
const router = useRouter();

const navItems = [
  { path: '/dashboard', label: '健康看板', icon: DataLine },
  { path: '/plans', label: '运动计划', icon: Calendar },
  { path: '/reports/weekly', label: '周报月报', icon: Document },
  { path: '/profile', label: '个人配置', icon: UserFilled }
];

const props = defineProps({
  viewMode: {
    type: String,
    default: 'single'
  }
});

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
  box-shadow: 0 2px 8px rgba(31, 45, 61, 0.04);
}

.primary-nav {
  display: flex;
  align-items: center;
  gap: 12px;
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
  color: #909399;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.nav-button:hover,
.nav-button.active {
  border-color: #d9ecff;
  background: #ecf5ff;
  color: #409eff;
}

.nav-button :deep(.el-icon) {
  font-size: 17px;
}

.nav-circle-button {
  width: 48px;
  height: 48px;
  border-color: #ebeef5;
  color: #909399;
}

.nav-circle-button:hover,
.nav-circle-button.active {
  border-color: #d9ecff;
  background: #ecf5ff;
  color: #409eff;
}

@media (max-width: 600px) {
  .top-navbar {
    gap: 10px;
    min-height: auto;
    padding: 12px;
  }

  .primary-nav {
    width: 100%;
  }

}
</style>


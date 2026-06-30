<template>
  <div class="settings-panel">
    <el-card shadow="hover" class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><Setting /></el-icon>
          <span>{{ t('settings.title') }}</span>
        </div>
      </template>

      <div class="settings-content">
        <!-- Language setting -->
        <div class="setting-item">
          <div class="setting-label">
            <span class="icon-emoji">🌐</span>
            <span>{{ t('settings.language') }}</span>
          </div>
          <el-select v-model="currentLanguage" size="small" style="width: 120px">
            <el-option label="中文" value="zh-CN" />
            <el-option label="English" value="en" />
          </el-select>
        </div>

        <!-- Theme setting -->
        <div class="setting-item">
          <div class="setting-label">
            <span class="icon-emoji">{{ isDarkMode ? '🌙' : '☀️' }}</span>
            <span>{{ t('settings.theme') }}</span>
          </div>
          <el-switch
            v-model="isDarkMode"
            inline-prompt
            active-text="暗"
            inactive-text="亮"
            size="default"
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { Setting } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore';
import { useThemeStore } from '../../stores/themeStore';

const localeStore = useLocaleStore();
const themeStore = useThemeStore();

// Language - use store value
const currentLanguage = computed({
  get: () => localeStore.currentLocale === 'zh-CN' ? 'zh-CN' : 'en',
  set: (val) => localeStore.setLocale(val)
});

// Theme - use store value
const isDarkMode = computed({
  get: () => themeStore.isDarkMode,
  set: (val) => themeStore.setTheme(val)
});

// Translation function
function t(key) {
  return localeStore.t(key);
}
</script>

<style scoped>
.settings-panel {
  margin-bottom: 20px;
}

.settings-card {
  border-radius: 12px;
  background: var(--card-bg);
  border-color: var(--card-border);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
  color: var(--text-primary);
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.icon-emoji {
  font-size: 18px;
  line-height: 1;
}
</style>

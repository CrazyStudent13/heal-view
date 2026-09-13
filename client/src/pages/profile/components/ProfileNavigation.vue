<template>
  <nav class="profile-nav" :aria-label="t('profile.title')">
    <RouterLink
      v-for="item in menuItems"
      :key="item.path"
      :to="item.path"
      class="profile-nav-item"
      :class="{ active: route.path === item.path }"
    >
      <el-icon aria-hidden="true"><component :is="item.icon" /></el-icon>
      <span>{{ t(item.label) }}</span>
    </RouterLink>
  </nav>
</template>

<script setup>
import { RouterLink, useRoute } from 'vue-router';
import { InfoFilled, Lock } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';

const { t } = useLocaleStore();
const route = useRoute();
const menuItems = [
  { path: '/profile/access', label: 'profile.access', icon: Lock },
  { path: '/profile/about', label: 'profile.about', icon: InfoFilled }
];
</script>

<template>
  <nav class="plans-nav" :aria-label="t('plans.title')">
    <RouterLink
      v-for="item in menuItems"
      :key="item.path"
      :to="item.path"
      class="plans-nav-item"
      :class="{ active: route.path === item.path }"
    >
      <el-icon aria-hidden="true"><component :is="item.icon" /></el-icon>
      <span>{{ t(item.labelKey) }}</span>
    </RouterLink>
  </nav>
</template>

<script setup>
import { RouterLink, useRoute } from 'vue-router';
import { Collection, List } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';

const { t } = useLocaleStore();
const route = useRoute();
const menuItems = [
  { path: '/plans/overview', labelKey: 'plans.overview', icon: List },
  { path: '/plans/exercises', labelKey: 'plans.exercise.title', icon: Collection }
];
</script>

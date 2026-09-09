<template>
  <div class="placeholder-page">
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <el-empty :description="t('profile.comingSoon')" :image-size="100" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useLocaleStore } from '../stores/localeStore.js';

const route = useRoute();
const localeStore = useLocaleStore();
const { t } = localeStore;
const title = computed(() => t(route.meta.titleKey || 'profile.title'));
const description = computed(() => t(route.meta.descriptionKey || 'profile.description'));
</script>

<style scoped lang="scss">
.placeholder-page {
  max-width: 760px;
}

h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 22px;
}

p {
  margin: 8px 0 24px;
  color: var(--text-secondary);
  font-size: 14px;
}
</style>

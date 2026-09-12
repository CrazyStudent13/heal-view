<template>
  <div class="about-page">
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>

    <div class="about-items">
      <div v-for="item in aboutItems" :key="item.key" class="about-item">
        <div class="about-item-copy">
          <h3>{{ t(item.titleKey) }}</h3>
          <p v-if="item.descriptionKey">{{ t(item.descriptionKey) }}</p>
        </div>
        <a
          v-if="item.href"
          class="about-item-link"
          :href="item.href"
          target="_blank"
          rel="noreferrer"
        >
          <span>{{ item.value }}</span>
          <el-icon aria-hidden="true"><Link /></el-icon>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Link } from '@element-plus/icons-vue';
import { useLocaleStore } from '../stores/localeStore.js';

const route = useRoute();
const localeStore = useLocaleStore();
const { t } = localeStore;
const title = computed(() => t(route.meta.titleKey || 'profile.title'));
const description = computed(() => t(route.meta.descriptionKey || 'profile.description'));

// Keep page entries data-driven so future runtime and version details can be added here.
const aboutItems = [
  {
    key: 'github',
    titleKey: 'profile.github',
    descriptionKey: 'profile.githubDescription',
    href: 'https://github.com/CrazyStudent13/heal-view',
    value: 'github.com/CrazyStudent13/heal-view'
  }
];
</script>

<style scoped lang="scss">
.about-page {
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

.about-items {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--card-border);
}

.about-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 72px;
  padding: 12px 0;
  border-bottom: 1px solid var(--card-border);
}

.about-item-copy {
  min-width: 0;
}

.about-item h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.about-item p {
  margin: 4px 0 0;
  font-size: 13px;
}

.about-item-link {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 6px;
  max-width: 55%;
  color: var(--primary-color);
  font-size: 14px;
  text-decoration: none;
  overflow-wrap: anywhere;
}

.about-item-link:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .about-item {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .about-item-link {
    max-width: 100%;
  }
}
</style>

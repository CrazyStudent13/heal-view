<template>
  <PageContainer class="plans-page" full-height content-width="none">
    <div class="plans-layout">
      <aside class="plans-sidebar page-surface-card">
        <div class="plans-heading page-surface-header">
          <div class="plans-icon">
            <el-icon><Calendar /></el-icon>
          </div>
          <h1>{{ t('plans.title') }}</h1>
        </div>

        <PlanNavigation />
      </aside>

      <main class="plans-content page-surface-card">
        <RouterView />
      </main>
    </div>
  </PageContainer>
</template>

<script setup>
import { RouterView } from 'vue-router';
import { Calendar } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import PageContainer from '@/components/ui/PageContainer.vue';
import PlanNavigation from '@/pages/plans/components/PlanNavigation.vue';

const { t } = useLocaleStore();
</script>

<style lang="scss">
.plans-page {
  padding: 16px;
}

.plans-layout {
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  gap: 16px;
}

.plans-sidebar,
.plans-content {
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.plans-sidebar {
  width: 320px;
  flex: 0 0 320px;
  padding: 0 12px 20px;
}

.plans-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 0 8px;
}

.plans-icon {
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

.plans-heading h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 20px;
  letter-spacing: 0;
}

.plans-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 16px;
}

.plans-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 14px;
  text-decoration: none;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.plans-nav-item:hover,
.plans-nav-item.active {
  color: var(--primary-color);
  background: var(--primary-light);
}

.plans-content {
  flex: 1 1 auto;
  min-width: 0;
  padding: 24px;
}

@media (max-width: 640px) {
  .plans-page {
    height: auto;
    min-height: 100%;
    overflow: visible;
    padding: 12px;
  }

  .plans-layout {
    flex-direction: column;
    height: auto;
  }

  .plans-sidebar {
    width: 100%;
    flex: none;
    height: auto;
    overflow: visible;
  }

  .plans-content {
    height: auto;
    min-height: 360px;
    overflow: visible;
    padding: 20px 16px;
  }

  .plans-nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .plans-nav-item {
    min-width: 0;
  }
}
</style>

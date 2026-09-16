<template>
  <section class="plan-overview">
    <header class="plan-content-header">
      <div>
        <h2>{{ t('plans.overview') }}</h2>
        <p>{{ t('plans.overviewDescription') }}</p>
      </div>
    </header>

    <div class="plan-overview-empty">
      <el-empty :description="t('plans.overviewEmpty')" />
    </div>
  </section>
</template>

<script setup>
import { useLocaleStore } from '@/stores/localeStore.js';

const { t } = useLocaleStore();
</script>

<style scoped lang="scss">
.plan-overview {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.plan-content-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--card-border);
}

h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 22px;
  letter-spacing: 0;
}

p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.plan-overview-empty {
  display: grid;
  flex: 1;
  min-height: 320px;
  place-items: center;
}
</style>

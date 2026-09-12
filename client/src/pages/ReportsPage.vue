<template>
  <PageContainer :title="t('reports.title')">
    <el-segmented
      v-model="period"
      :options="periodOptions"
      class="period-switch"
    />
    <el-empty :description="emptyDescription" :image-size="120" />
  </PageContainer>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLocaleStore } from '../stores/localeStore.js';
import PageContainer from '../components/common/PageContainer.vue';

const { t } = useLocaleStore();
const route = useRoute();
const router = useRouter();

const periodOptions = computed(() => [
  { label: t('reports.weekly'), value: 'weekly' },
  { label: t('reports.monthly'), value: 'monthly' }
]);

const period = computed({
  get: () => route.params.period || 'weekly',
  set: value => router.push(`/reports/${value}`)
});

const emptyDescription = computed(() => {
  return period.value === 'monthly'
    ? t('reports.monthlyComingSoon')
    : t('reports.weeklyComingSoon');
});
</script>

<style scoped lang="scss">
.period-switch {
  margin: 12px 0 20px;
}
</style>

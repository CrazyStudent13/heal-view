<template>
  <div class="module-page">
    <SectionTitle>周报月报</SectionTitle>
    <el-segmented
      v-model="period"
      :options="periodOptions"
      class="period-switch"
    />
    <el-empty :description="emptyDescription" :image-size="120" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const periodOptions = [
  { label: '周报', value: 'weekly' },
  { label: '月报', value: 'monthly' }
];

const period = computed({
  get: () => route.params.period || 'weekly',
  set: (value) => router.push(`/reports/${value}`)
});

const emptyDescription = computed(() => {
  return period.value === 'monthly'
    ? '月报模块待接入'
    : '周报模块待接入';
});
</script>

<style scoped lang="scss">
.module-page {
  padding: 20px;
  min-height: calc(100vh - 80px);
  background: var(--app-bg);
}

.period-switch {
  margin: 12px 0 20px;
}
</style>

<template>
  <PageContainer :title="t('plans.title')" card content-width="none">
    <AsyncState empty :empty-description="t('plans.comingSoon')" />
  </PageContainer>
</template>

<script setup>
import { useLocaleStore } from '@/stores/localeStore.js';
import AsyncState from '@/components/ui/AsyncState.vue';
import PageContainer from '@/components/ui/PageContainer.vue';

const { t } = useLocaleStore();
</script>

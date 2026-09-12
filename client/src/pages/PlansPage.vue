<template>
  <PageContainer :title="t('plans.title')" card content-width="none">
    <AsyncState empty :empty-description="t('plans.comingSoon')" />
  </PageContainer>
</template>

<script setup>
import { useLocaleStore } from '../stores/localeStore.js';
import AsyncState from '../components/common/AsyncState.vue';
import PageContainer from '../components/common/PageContainer.vue';

const { t } = useLocaleStore();
</script>

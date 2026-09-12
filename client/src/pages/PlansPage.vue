<template>
  <PageContainer :title="t('plans.title')" card content-width="none">
    <el-empty :description="t('plans.comingSoon')" :image-size="120" />
  </PageContainer>
</template>

<script setup>
import { useLocaleStore } from '../stores/localeStore.js';
import PageContainer from '../components/common/PageContainer.vue';

const { t } = useLocaleStore();
</script>

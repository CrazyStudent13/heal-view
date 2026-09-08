<template>
  <DataImportPage
    @imported="dashboard.handleImportCompleted"
    @view-dashboard="handleViewDashboard"
  />
</template>

<script setup>
import { inject } from 'vue';
import { useRouter } from 'vue-router';
import DataImportPage from '../components/import/DataImportPage.vue';
import { dashboardContextKey } from '../composables/dashboardContext.js';

const dashboard = inject(dashboardContextKey);
const router = useRouter();

if (!dashboard) {
  throw new Error('Dashboard context is missing');
}

async function handleViewDashboard() {
  await dashboard.handleImportCompleted();
  router.push('/dashboard');
}
</script>

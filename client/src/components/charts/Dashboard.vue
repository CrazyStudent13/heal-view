<template>
  <UnifiedDashboard :view-mode="viewMode" />
</template>

<script setup>
import UnifiedDashboard from './UnifiedDashboard.vue';

defineProps({
  viewMode: {
    type: String,
    default: 'single',
    validator: (value) => ['single', 'compare'].includes(value)
  }
});
</script>

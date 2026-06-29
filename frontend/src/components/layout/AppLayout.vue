<template>
  <div class="app-layout">
    <div class="sidebar-container">
      <ViewModeTabs v-model="viewMode" />
      <Sidebar :view-mode="viewMode" />
    </div>
    <div class="main-content">
      <DataFilter v-if="viewMode === 'compare'" />
      <Dashboard :view-mode="viewMode" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ViewModeTabs from '../common/ViewModeTabs.vue';
import Sidebar from './Sidebar.vue';
import DataFilter from '../filters/DataFilter.vue';
import Dashboard from '../charts/Dashboard.vue';

const viewMode = ref('single');
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar-container {
  width: 280px;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f5f5f5;
}
</style>

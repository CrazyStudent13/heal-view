<template>
  <div class="data-filter" v-if="filterStore.sportTypes.length > 0">
    <div class="filter-group">
      <label class="filter-label">运动类型</label>
      <div class="sport-type-checkboxes">
        <label
          v-for="type in filterStore.sportTypes"
          :key="type"
          class="checkbox-item"
        >
          <input
            type="checkbox"
            :checked="filterStore.selectedSportTypes.includes(type)"
            @change="filterStore.toggleSportType(type)"
          />
          <span>{{ formatSportType(type) }}</span>
        </label>
      </div>
    </div>

    <div class="filter-actions">
      <button @click="handleReset" class="reset-btn">重置筛选</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useFilterStore } from '../../stores/filterStore.js';

const filterStore = useFilterStore();

// Format sport type for display
function formatSportType(type) {
  const typeMap = {
    'walking': '步行',
    'outdoor_riding': '户外骑行',
    'outdoor_hiking': '户外徒步',
    'elliptical_trainer': '椭圆机',
    'rowing_machine': '划船机',
    'free_training': '自由训练',
    'outdoor_running': '户外跑步'
  };
  return typeMap[type] || type;
}

// Handle reset
function handleReset() {
  filterStore.resetFilters();
}

// Fetch filter options on mount
onMounted(() => {
  filterStore.fetchFilterOptions();
});
</script>

<style scoped>
.data-filter {
  background: #fff;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.filter-group {
  margin-bottom: 0;
}

.filter-label {
  display: block;
  font-size: 14px;
  color: #333;
  margin-bottom: 12px;
  font-weight: 500;
}

.sport-type-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
}

.checkbox-item input[type="checkbox"] {
  cursor: pointer;
}

.filter-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e8e8e8;
}

.reset-btn {
  padding: 6px 16px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s;
}

.reset-btn:hover {
  color: #1890ff;
  border-color: #1890ff;
}
</style>

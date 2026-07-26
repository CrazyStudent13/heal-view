<template>
  <div class="data-filter" v-if="filterStore.sportTypes.length > 0">
    <div class="filter-group">
      <label class="filter-label">{{ t('nav.sportType') }}</label>
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
      <button @click="handleReset" class="reset-btn">{{ t('common.reset') }}</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useFilterStore } from '../../stores/filterStore.js';
import { useLocaleStore } from '../../stores/localeStore.js';

const filterStore = useFilterStore();
const { t } = useLocaleStore();

// Format sport type for display
function formatSportType(type) {
  const typeMap = {
    walking: 'walking',
    outdoor_riding: 'outdoorRiding',
    outdoor_hiking: 'outdoorHiking',
    elliptical_trainer: 'elliptical',
    rowing_machine: 'rowing',
    free_training: 'freeTraining',
    outdoor_running: 'outdoorRunning'
  };
  return typeMap[type] ? t(`sport.typeName.${typeMap[type]}`) : type;
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

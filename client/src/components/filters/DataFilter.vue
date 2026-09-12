<template>
  <div class="data-filter">
    <AsyncState
      v-if="filterStore.loading || filterStore.error || filterStore.sportTypes.length === 0"
      :loading="filterStore.loading"
      :error="filterStore.error"
      :empty="!filterStore.loading && !filterStore.error && filterStore.sportTypes.length === 0"
      :show-retry="Boolean(filterStore.error)"
      :empty-description="t('filter.noOptions')"
      @retry="filterStore.fetchFilterOptions"
    />

    <div v-else class="filter-group">
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

      <div class="filter-actions">
        <button type="button" @click="handleReset" class="reset-btn">{{ t('common.reset') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useFilterStore } from '../../stores/filterStore.js';
import { useLocaleStore } from '../../stores/localeStore.js';
import AsyncState from '../common/AsyncState.vue';

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

<style scoped lang="scss">
.data-filter {
  background: var(--card-bg);
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid var(--card-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.filter-group {
  margin-bottom: 0;
}

.filter-label {
  display: block;
  font-size: 14px;
  color: var(--text-primary);
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
  color: var(--text-secondary);
}

.checkbox-item input[type="checkbox"] {
  cursor: pointer;
}

.filter-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--card-border);
}

.reset-btn {
  padding: 6px 16px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.reset-btn:hover {
  color: var(--primary-color);
  border-color: var(--primary-color);
}
</style>


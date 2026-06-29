<template>
  <div class="sidebar">
    <!-- Selection controls for compare mode -->
    <div v-if="viewMode === 'compare'" class="selection-controls">
      <button @click="handleSelectAll" class="control-btn">全选</button>
      <button @click="handleClearAll" class="control-btn">全不选</button>
      <span class="selected-count">已选 {{ store.selectedDates.length }} 天</span>
    </div>

    <div class="date-list" v-if="!store.loading">
      <div
        v-for="date in displayDates"
        :key="date"
        class="date-item"
        :class="{ 
          active: viewMode === 'single' && date === store.selectedDate,
          selected: viewMode === 'compare' && store.selectedDates.includes(date)
        }"
        @click="handleDateClick(date)"
      >
        <input
          v-if="viewMode === 'compare'"
          type="checkbox"
          :checked="store.selectedDates.includes(date)"
          @click.stop
          class="date-checkbox"
        />
        <div class="date-content">
          <span class="date-text">{{ formatDate(date) }}</span>
          <span class="date-raw">{{ date }}</span>
        </div>
      </div>
    </div>

    <div v-else class="loading">
      <p>加载中...</p>
    </div>

    <div v-if="store.error" class="error">
      <p>{{ store.error }}</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { useDateStore } from '../../stores/dateStore.js';

const props = defineProps({
  viewMode: {
    type: String,
    default: 'single',
    validator: (value) => ['single', 'compare'].includes(value)
  }
});

const store = useDateStore();

// Display dates based on view mode
const displayDates = computed(() => {
  if (props.viewMode === 'compare') {
    // In compare mode, only show dates with training data
    return store.trainingDates;
  }
  // In single mode, show all dates
  return store.dateList;
});

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Get weekday
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[date.getDay()];

  return `${year}-${month}-${day} (${weekday})`;
}

// Handle date click
function handleDateClick(date) {
  if (props.viewMode === 'single') {
    store.selectDate(date);
  } else {
    store.toggleDateSelection(date);
  }
}

// Select all training dates
function handleSelectAll() {
  store.selectAllTrainingDates();
}

// Clear all selections
function handleClearAll() {
  store.clearSelectedDates();
}

// Fetch dates on mount
onMounted(() => {
  store.fetchDateList();
});
</script>

<style scoped>
.sidebar {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.selection-controls {
  padding: 12px 20px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  gap: 8px;
  align-items: center;
  background: #fafafa;
}

.control-btn {
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  transition: all 0.2s;
}

.control-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.selected-count {
  margin-left: auto;
  font-size: 13px;
  color: #999;
}

.date-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.date-item {
  padding: 12px 20px;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 3px solid transparent;
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-item:hover {
  background: #f5f5f5;
}

.date-item.active {
  background: #e6f7ff;
  border-left-color: #1890ff;
}

.date-item.selected {
  background: #f6ffed;
  border-left-color: #52c41a;
}

.date-checkbox {
  cursor: pointer;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.date-content {
  flex: 1;
}

.date-text {
  display: block;
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
}

.date-raw {
  display: block;
  font-size: 12px;
  color: #999;
}

.loading, .error {
  padding: 20px;
  text-align: center;
  color: #999;
}

.error {
  color: #ff4d4f;
}
</style>

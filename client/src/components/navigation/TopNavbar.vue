<template>
  <div class="top-navbar">
    <nav class="primary-nav">
      <button
        :class="['nav-button', { active: currentPage === 'dashboard' }]"
        type="button"
        @click="$emit('page-change', 'dashboard')"
      >
        <el-icon><DataLine /></el-icon>
        <span>健康看板</span>
      </button>
      <button
        :class="['nav-button', { active: currentPage === 'import' }]"
        type="button"
        @click="$emit('page-change', 'import')"
      >
        <el-icon><UploadFilled /></el-icon>
        <span>数据导入</span>
      </button>
    </nav>

    <el-divider v-if="showDateControls" direction="vertical" />

    <!-- View mode tabs -->
    <el-radio-group v-if="showDateControls" v-model="viewModeLocal" size="default">
      <el-radio-button value="single">{{ t('nav.singleDay') }}</el-radio-button>
      <el-radio-button value="compare">{{ t('nav.multiDay') }}</el-radio-button>
    </el-radio-group>

    <el-divider v-if="showDateControls" direction="vertical" />

    <!-- Date selection -->
    <div v-if="showDateControls" class="date-section">
      <span class="section-label">{{ t('nav.selectDate') }}：</span>
      
      <!-- Single mode: date picker -->
      <el-date-picker
        v-if="viewMode === 'single'"
        v-model="selectedSingleDate"
        type="date"
        :placeholder="t('nav.selectDate')"
        format="YYYY-MM-DD (dddd)"
        value-format="YYYY-MM-DD"
        :disabled-date="disabledDate"
        style="width: 220px; margin-left: 8px"
      />
      
      <el-button 
        v-if="viewMode === 'single'"
        type="primary" 
        plain 
        size="default" 
        style="margin-left: 12px"
        @click="handleSingleQuery"
      >
        <el-icon style="margin-right: 6px"><Search /></el-icon>
        {{ t('common.query') }}
      </el-button>

      <!-- Compare mode: date range -->
      <template v-else>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          :start-placeholder="t('nav.startDate')"
          :end-placeholder="t('nav.endDate')"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          :shortcuts="dateShortcuts"
          style="width: 360px; margin-left: 8px"
        />
        
        <el-button 
          type="primary" 
          plain 
          size="default" 
          style="margin-left: 12px"
          @click="handleQuery"
        >
          <el-icon style="margin-right: 6px"><Search /></el-icon>
          {{ t('common.query') }}
        </el-button>
      </template>
    </div>

    <div style="flex: 1"></div>

    <!-- Settings button -->
    <el-button 
      :icon="Setting" 
      circle 
      size="large"
      class="nav-circle-button"
      @click="$emit('open-settings')"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { DataLine, Setting, Search, UploadFilled } from '@element-plus/icons-vue';
import { useDateStore } from '../../stores/dateStore.js';
import { useLocaleStore } from '../../stores/localeStore';

const localeStore = useLocaleStore();

// Translation function
function t(key) {
  return localeStore.t(key);
}

const emit = defineEmits(['update:viewMode', 'open-settings', 'page-change']);

// Date picker shortcuts
const dateShortcuts = computed(() => [
  {
    text: t('nav.lastWeek'),
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
      return [start, end];
    }
  },
  {
    text: t('nav.lastMonth'),
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
      return [start, end];
    }
  },
  {
    text: t('nav.lastThreeMonths'),
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 90);
      return [start, end];
    }
  }
]);

const props = defineProps({
  viewMode: {
    type: String,
    default: 'single'
  },
  currentPage: {
    type: String,
    default: 'dashboard'
  },
  showDateControls: {
    type: Boolean,
    default: true
  }
});

const store = useDateStore();

const viewModeLocal = computed({
  get: () => props.viewMode,
  set: (value) => emit('update:viewMode', value)
});

const selectedSingleDate = ref('');
const dateRange = ref([]);

// Disable future dates
function disabledDate(time) {
  return time.getTime() > Date.now();
}

// Single mode query button handler
function handleSingleQuery() {
  if (selectedSingleDate.value) {
    store.selectDate(selectedSingleDate.value);
  }
}

// Query button handler - applies the date range filter
function handleQuery() {
  if (dateRange.value && dateRange.value.length === 2) {
    const [start, end] = dateRange.value;
    
    // Filter dates within range
    const filteredDates = store.trainingDates.filter(date => {
      const d = new Date(date);
      const startDate = new Date(start);
      const endDate = new Date(end);
      return d >= startDate && d <= endDate;
    });
    
    // Update selected dates
    store.selectedDates = filteredDates;
  }
}

// Quick select: last week
function selectLastWeek() {
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const startDate = formatDate(oneWeekAgo);
  const endDate = formatDate(today);
  
  dateRange.value = [startDate, endDate];
  
  // Filter and select dates within range
  const filteredDates = store.trainingDates.filter(date => {
    const d = new Date(date);
    return d >= oneWeekAgo && d <= today;
  });
  
  store.selectedDates = filteredDates;
}

// Quick select: last month
function selectLastMonth() {
  const today = new Date();
  const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const startDate = formatDate(oneMonthAgo);
  const endDate = formatDate(today);
  
  dateRange.value = [startDate, endDate];
  
  // Filter and select dates within range
  const filteredDates = store.trainingDates.filter(date => {
    const d = new Date(date);
    return d >= oneMonthAgo && d <= today;
  });
  
  store.selectedDates = filteredDates;
}

// Quick select: last three months
function selectLastThreeMonths() {
  const today = new Date();
  const threeMonthsAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  const startDate = formatDate(threeMonthsAgo);
  const endDate = formatDate(today);
  
  dateRange.value = [startDate, endDate];
  
  // Filter and select dates within range
  const filteredDates = store.trainingDates.filter(date => {
    const d = new Date(date);
    return d >= threeMonthsAgo && d <= today;
  });
  
  store.selectedDates = filteredDates;
}

// Helper function to format date as YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultSingleDate() {
  if (store.selectedDate) return store.selectedDate;
  if (store.dateList.length === 0) return '';

  const today = formatDate(new Date());
  return store.dateList.includes(today) ? today : store.dateList[0];
}

// Initialize
onMounted(() => {
  // Set initial date in single mode
  if (props.viewMode === 'single') {
    selectedSingleDate.value = getDefaultSingleDate();
  }
  
  // Set initial date range in compare mode
  if (props.viewMode === 'compare' && store.selectedDates.length > 0) {
    const sorted = [...store.selectedDates].sort((a, b) => new Date(a) - new Date(b));
    if (sorted.length > 0) {
      dateRange.value = [sorted[0], sorted[sorted.length - 1]];
    }
  }
});

// Watch for view mode changes and update date range display
watch(() => props.viewMode, (newMode) => {
  if (newMode === 'single') {
    // Clear date range when switching to single mode
    dateRange.value = [];
    
    // Set initial date in single mode
    selectedSingleDate.value = getDefaultSingleDate();
  } else if (store.selectedDates.length > 0) {
    // Update date range display when switching to compare mode
    const sorted = [...store.selectedDates].sort((a, b) => new Date(a) - new Date(b));
    if (sorted.length > 0) {
      dateRange.value = [sorted[0], sorted[sorted.length - 1]];
    }
  }
});

// Watch for selected dates changes to update date range display (only in compare mode)
watch(() => store.selectedDates, (newDates) => {
  if (props.viewMode === 'compare' && newDates.length > 0) {
    const sorted = [...newDates].sort((a, b) => new Date(a) - new Date(b));
    dateRange.value = [sorted[0], sorted[sorted.length - 1]];
  }
}, { deep: true });

watch(() => store.selectedDate, (newDate) => {
  if (props.viewMode === 'single') {
    selectedSingleDate.value = newDate || getDefaultSingleDate();
  }
});

watch(() => store.dateList, () => {
  if (props.viewMode === 'single' && !selectedSingleDate.value) {
    selectedSingleDate.value = getDefaultSingleDate();
  }
}, { deep: true });
</script>

<style scoped>
.top-navbar {
  background: var(--card-bg);
  border-bottom: 1px solid var(--card-border);
  min-height: 78px;
  padding: 16px 42px;
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  box-shadow: 0 2px 8px rgba(31, 45, 61, 0.04);
}

.primary-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #909399;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.nav-button:hover,
.nav-button.active {
  border-color: #d9ecff;
  background: #ecf5ff;
  color: #409eff;
}

.nav-button :deep(.el-icon) {
  font-size: 17px;
}

.nav-circle-button {
  width: 48px;
  height: 48px;
  border-color: #ebeef5;
  color: #909399;
}

.date-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-label {
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
}

@media (max-width: 600px) {
  .top-navbar {
    gap: 10px;
    min-height: auto;
    padding: 12px;
  }

  .top-navbar > :deep(.el-divider--vertical) {
    display: none;
  }

  .primary-nav {
    width: 100%;
  }

  .date-section {
    order: 2;
    width: 100%;
  }

  .date-section :deep(.el-date-editor.el-input),
  .date-section :deep(.el-date-editor--daterange) {
    flex: 1;
    min-width: 0;
    width: auto !important;
    margin-left: 0 !important;
  }

  .date-section :deep(.el-button) {
    margin-left: 0 !important;
  }
}

@media (max-width: 420px) {
  .section-label {
    display: none;
  }
}
</style>

<template>
  <div class="top-navbar">
    <!-- View mode tabs -->
    <el-radio-group v-model="viewModeLocal" size="default">
      <el-radio-button value="single">{{ t('nav.singleDay') }}</el-radio-button>
      <el-radio-button value="compare">{{ t('nav.multiDay') }}</el-radio-button>
    </el-radio-group>

    <el-divider direction="vertical" />

    <!-- Date selection -->
    <div class="date-section">
      <el-icon><Calendar /></el-icon>
      
      <!-- Single mode: date picker -->
      <el-date-picker
        v-if="viewMode === 'single'"
        v-model="selectedSingleDate"
        type="date"
        placeholder="选择日期"
        format="YYYY-MM-DD (dddd)"
        value-format="YYYY-MM-DD"
        :disabled-date="disabledDate"
        style="width: 220px; margin-left: 8px"
        @change="handleSingleDateChange"
      />

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
          @change="handleDateRangeChange"
        />
        
        <el-button 
          type="success" 
          plain 
          size="small" 
          style="margin-left: 12px"
          @click="handleSelectAll"
        >
          {{ t('common.selectAll') }}
        </el-button>
      </template>
    </div>

    <el-divider direction="vertical" />

    <!-- Sport type filter -->
    <div class="sport-section" v-if="filterStore.sportTypes.length > 0">
      <span class="section-label">{{ t('nav.sportType') }}：</span>
      <el-select
        v-model="filterStore.selectedSportTypes"
        multiple
        collapse-tags
        collapse-tags-tooltip
        :placeholder="t('nav.selectSport')"
        style="width: 200px"
        :max-collapse-tags="2"
      >
        <el-option
          v-for="type in filterStore.sportTypes"
          :key="type"
          :label="formatSportType(type)"
          :value="type"
        />
      </el-select>
    </div>

    <el-divider direction="vertical" />

    <!-- Reset button -->
    <el-button type="danger" plain size="default" @click="handleReset">
      <el-icon><RefreshLeft /></el-icon>
      {{ t('common.reset') }}
    </el-button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { Calendar, RefreshLeft } from '@element-plus/icons-vue';
import { useDateStore } from '../../stores/dateStore.js';
import { useFilterStore } from '../../stores/filterStore.js';
import { useLocaleStore } from '../../stores/localeStore';

const localeStore = useLocaleStore();

// Translation function
function t(key) {
  return localeStore.t(key);
}

// Date picker shortcuts
const dateShortcuts = [
  {
    text: '最近一周',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
      return [start, end];
    }
  },
  {
    text: '最近一月',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
      return [start, end];
    }
  },
  {
    text: '最近三月',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 90);
      return [start, end];
    }
  }
];

const props = defineProps({
  viewMode: {
    type: String,
    default: 'single'
  }
});

const emit = defineEmits(['update:viewMode']);

const store = useDateStore();
const filterStore = useFilterStore();

const viewModeLocal = computed({
  get: () => props.viewMode,
  set: (value) => emit('update:viewMode', value)
});

const selectedSingleDate = ref('');
const dateRange = ref([]);

// Format sport type
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

// Disable future dates
function disabledDate(time) {
  return time.getTime() > Date.now();
}

// Handle single date change
function handleSingleDateChange(value) {
  if (value) {
    store.selectDate(value);
  }
}

// Handle date range change
function handleDateRangeChange(value) {
  if (value && value.length === 2) {
    const [start, end] = value;
    
    // Filter dates within range
    const filteredDates = store.trainingDates.filter(date => {
      const d = new Date(date);
      const startDate = new Date(start);
      const endDate = new Date(end);
      return d >= startDate && d <= endDate;
    });
    
    // Auto select filtered dates
    store.selectedDates = filteredDates;
  }
}

// Select all training dates
function handleSelectAll() {
  store.selectAllTrainingDates();
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

// Handle reset
function handleReset() {
  selectedSingleDate.value = '';
  dateRange.value = [];
  filterStore.resetFilters();
  
  // Reset to first date in single mode
  if (props.viewMode === 'single' && store.dateList.length > 0) {
    store.selectDate(store.dateList[0]);
    selectedSingleDate.value = store.dateList[0];
  }
}

// Initialize
onMounted(() => {
  filterStore.fetchFilterOptions();
  
  // Set initial date in single mode
  if (store.dateList.length > 0) {
    selectedSingleDate.value = store.dateList[0];
  }
});

// Watch for view mode changes and update date range display
watch(() => props.viewMode, (newMode) => {
  if (newMode === 'single') {
    // Clear date range when switching to single mode
    dateRange.value = [];
  } else if (store.selectedDates.length > 0) {
    // Update date range display when switching to compare mode
    const sorted = [...store.selectedDates].sort((a, b) => new Date(a) - new Date(b));
    if (sorted.length > 0) {
      dateRange.value = [sorted[0], sorted[sorted.length - 1]];
    }
  }
});

// Watch for selected dates changes to update date range display
watch(() => store.selectedDates, (newDates) => {
  if (props.viewMode === 'compare' && newDates.length > 0) {
    const sorted = [...newDates].sort((a, b) => new Date(a) - new Date(b));
    dateRange.value = [sorted[0], sorted[sorted.length - 1]];
  }
}, { deep: true });
</script>

<style scoped>
.top-navbar {
  background: var(--card-bg);
  border-bottom: 1px solid var(--card-border);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.date-section,
.sport-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-label {
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>

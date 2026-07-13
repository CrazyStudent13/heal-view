<template>
  <div class="data-cards-sidebar">
    <h3 class="sidebar-title">
      <el-icon><DataLine /></el-icon>
      {{ t('data.overview') }}
    </h3>
    
    <!-- Skeleton loading state -->
    <div v-if="loading" class="cards-list">
      <el-card class="card-item" shadow="hover" v-for="i in 5" :key="i">
        <div class="card-content">
          <el-skeleton :rows="0" animated>
            <template #image>
              <el-skeleton-item variant="circle" style="width: 48px; height: 48px;" />
            </template>
            <template #default>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <el-skeleton-item variant="text" style="width: 60%;" />
                <el-skeleton-item variant="text" style="width: 40%;" />
              </div>
            </template>
          </el-skeleton>
        </div>
      </el-card>
    </div>
    
    <div class="cards-list" v-else-if="hasData">
      <!-- Personal data card - only show in single mode -->
      <el-card 
        v-if="!isCompareMode"
        class="card-item clickable"
        :class="{ active: currentChartType === 'personal' }"
        shadow="hover"
        @click="$emit('chart-change', 'personal')"
      >
        <div class="card-content">
          <div class="card-icon personal">
            <span class="icon-text">👤</span>
          </div>
          <div class="card-info">
            <div class="card-label">{{ t('data.personalInfo') }}</div>
            <div class="card-value" v-if="userProfile && userProfile.weight">{{ userProfile.weight }} kg</div>
            <div class="card-value" v-else>{{ t('data.viewDetails') }}</div>
          </div>
        </div>
      </el-card>
      
      <el-card 
        v-if="isCompareMode"
        class="card-item clickable"
        :class="{ active: currentChartType === 'weight' }"
        shadow="hover"
        @click="$emit('chart-change', 'weight')"
      >
        <div class="card-content">
          <div class="card-icon weight">
            <span class="icon-text">⚖️</span>
          </div>
          <div class="card-info">
            <div class="card-label">{{ t('data.avgWeight') }}</div>
            <div class="card-value">{{ displayData.avgWeight }} kg</div>
          </div>
        </div>
      </el-card>
      
      <el-card 
        class="card-item clickable"
        :class="{ active: currentChartType === 'steps' }"
        shadow="hover"
        @click="$emit('chart-change', 'steps')"
      >
        <div class="card-content">
          <div class="card-icon steps">
            <span class="icon-text">👟</span>
          </div>
          <div class="card-info">
            <div class="card-label">{{ isCompareMode ? t('data.avgSteps') : t('data.steps') }}</div>
            <div class="card-value">{{ formatSteps(displayData.avgSteps) }}</div>
          </div>
        </div>
      </el-card>

      <el-card 
        class="card-item clickable"
        :class="{ active: currentChartType === 'heartrate' }"
        shadow="hover"
        @click="$emit('chart-change', 'heartrate')"
      >
        <div class="card-content">
          <div class="card-icon heartrate">
            <span class="icon-text">❤️</span>
          </div>
          <div class="card-info">
            <div class="card-label">{{ t('data.heartRate') }}</div>
            <div class="card-value">{{ displayData.avgHeartRate }} bpm</div>
          </div>
        </div>
      </el-card>

      <el-card 
        class="card-item clickable"
        :class="{ active: currentChartType === 'sleep' }"
        shadow="hover"
        @click="$emit('chart-change', 'sleep')"
      >
        <div class="card-content">
          <div class="card-icon sleep">
            <span class="icon-text">🌙</span>
          </div>
          <div class="card-info">
            <div class="card-label">{{ isCompareMode ? t('data.avgSleep') : t('data.sleep') }}</div>
            <div class="card-value">{{ displayData.avgSleepHours }} h</div>
          </div>
        </div>
      </el-card>

      <el-card 
        v-if="isCompareMode"
        class="card-item clickable"
        :class="{ active: currentChartType === 'calories' }"
        shadow="hover"
        @click="$emit('chart-change', 'calories')"
      >
        <div class="card-content">
          <div class="card-icon calories">
            <span class="icon-text">🔥</span>
          </div>
          <div class="card-info">
            <div class="card-label">{{ t('data.avgCalories') }}</div>
            <div class="card-value">{{ formatNumber(displayData.avgCalories) }} kcal</div>
          </div>
        </div>
      </el-card>
    </div>

    <el-empty v-else :description="t('chart.selectDate')" :image-size="100" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { DataLine } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore';

const localeStore = useLocaleStore();

// Translation function
function t(key) {
  return localeStore.t(key);
}

const props = defineProps({
  chartData: {
    type: Array,
    default: () => []
  },
  currentChartType: {
    type: String,
    default: 'steps'
  },
  viewMode: {
    type: String,
    default: 'single'
  },
  loading: {
    type: Boolean,
    default: false
  },
  userProfile: {
    type: Object,
    default: null
  }
});

defineEmits(['chart-change']);

const isCompareMode = computed(() => props.viewMode === 'compare');

// BMI category short label for sidebar card
const bmiCategoryShort = computed(() => {
  if (!props.userProfile || !props.userProfile.bmi) return '';
  const bmi = props.userProfile.bmi;
  if (bmi < 18.5) return t('personal.bmiUnderweight');
  if (bmi < 24) return t('personal.bmiNormal');
  if (bmi < 28) return t('personal.bmiOverweight');
  return t('personal.bmiObese');
});

const hasData = computed(() => props.chartData.length > 0);

function isPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

const displayData = computed(() => {
  if (props.chartData.length === 0) {
    return { avgSteps: 0, avgCalories: 0, avgHeartRate: 0, avgStress: 0, avgSleepHours: 0, avgWeight: '--' };
  }

  if (isCompareMode.value) {
    const avgSteps = Math.round(props.chartData.reduce((acc, item) => acc + (Number(item.steps) || 0), 0) / props.chartData.length);
    const avgCalories = Math.round(props.chartData.reduce((acc, item) => acc + (Number(item.calories) || 0), 0) / props.chartData.length);
    const heartRateItems = props.chartData.filter(item => isPositiveNumber(item.avgHeartRate));
    const avgHeartRate = heartRateItems.length > 0
      ? Math.round(heartRateItems.reduce((acc, item) => acc + Number(item.avgHeartRate), 0) / heartRateItems.length)
      : 0;
    const avgSleepHours = (props.chartData.reduce((acc, item) => acc + (item.sleepHours || 0), 0) / props.chartData.length).toFixed(1);

    const avgWeightItems = props.chartData.filter(item => isPositiveNumber(item.avgWeight));
    const avgWeight = avgWeightItems.length > 0
      ? (avgWeightItems.reduce((acc, item) => acc + Number(item.avgWeight), 0) / avgWeightItems.length).toFixed(1)
      : '--';

    return { avgSteps, avgCalories, avgHeartRate, avgSleepHours, avgWeight };
  } else {
    const item = props.chartData[0];
    return {
      avgSteps: item.steps || 0,
      avgCalories: item.calories || 0,
      avgHeartRate: item.avgHeartRate || 0,
      avgSleepHours: item.sleepHours || 0,
      avgWeight: item.avgWeight || 0
    };
  }
});

function formatNumber(num) {
  if (num === '--') return num;
  return (Number(num) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatSteps(num) {
  return `${formatNumber(num)} ${t('chart.unitSteps')}`;
}
</script>

<style scoped>
.data-cards-sidebar {
  width: 100%;
  height: 100%;
  padding: 20px;
  overflow-y: auto;
}

.sidebar-title {
  margin: 0 0 24px 0;
  font-size: 18px;
  color: var(--text-primary);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cards-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-item {
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid var(--card-border);
  border-radius: 8px;
  background: var(--card-bg);
  min-height: 90px;
}

.card-item :deep(.el-card__body) {
  padding: 16px 20px;
}

.card-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--primary-color);
}

.card-item.active {
  border-color: var(--primary-color);
  background: var(--primary-light);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}

.card-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 28px;
}

.icon-text {
  line-height: 1;
}

.card-icon.steps {
  background: var(--primary-light);
  color: var(--primary-color);
}

.card-icon.calories {
  background: rgba(103, 194, 58, 0.12);
  color: var(--success-color);
}

.card-icon.heartrate {
  background: rgba(245, 108, 108, 0.12);
  color: var(--danger-color);
}

.card-icon.sleep {
  background: rgba(250, 140, 22, 0.12);
  color: var(--warning-color);
}

.card-icon.weight {
  background: rgba(192, 132, 252, 0.12);
  color: #a855f7;
}

.card-icon.personal {
  background: var(--primary-light);
  color: var(--primary-color);
}

.card-info {
  flex: 1;
}

.card-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.card-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}
</style>

<template>
  <div class="data-cards-sidebar">
    <h3 class="sidebar-title">
      <el-icon><DataLine /></el-icon>
      {{ t('data.overview') }}
    </h3>
    
    <div class="cards-list" v-if="hasData">
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
            <div class="card-value">{{ formatNumber(displayData.avgSteps) }}</div>
          </div>
        </div>
      </el-card>

      <el-card 
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
            <div class="card-label">{{ isCompareMode ? t('data.avgCalories') : t('data.calories') }}</div>
            <div class="card-value">{{ formatNumber(displayData.avgCalories) }} kcal</div>
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
        :class="{ active: currentChartType === 'stress' }"
        shadow="hover"
        @click="$emit('chart-change', 'stress')"
      >
        <div class="card-content">
          <div class="card-icon stress">
            <span class="icon-text">📊</span>
          </div>
          <div class="card-info">
            <div class="card-label">{{ isCompareMode ? t('data.avgStress') : t('data.stress') }}</div>
            <div class="card-value">{{ displayData.avgStress }}</div>
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
  }
});

defineEmits(['chart-change']);

const isCompareMode = computed(() => props.viewMode === 'compare');

const hasData = computed(() => props.chartData.length > 0);

const displayData = computed(() => {
  if (props.chartData.length === 0) {
    return { avgSteps: 0, avgCalories: 0, avgHeartRate: 0, avgStress: 0, avgSleepHours: 0 };
  }

  if (isCompareMode.value) {
    const avgSteps = Math.round(props.chartData.reduce((acc, item) => acc + item.steps, 0) / props.chartData.length);
    const avgCalories = Math.round(props.chartData.reduce((acc, item) => acc + item.calories, 0) / props.chartData.length);
    const avgHeartRate = Math.round(props.chartData.reduce((acc, item) => acc + item.avgHeartRate, 0) / props.chartData.length);
    const avgStress = Math.round(props.chartData.reduce((acc, item) => acc + item.avgStress, 0) / props.chartData.length);
    const avgSleepHours = (props.chartData.reduce((acc, item) => acc + (item.sleepHours || 0), 0) / props.chartData.length).toFixed(1);

    return { avgSteps, avgCalories, avgHeartRate, avgStress, avgSleepHours };
  } else {
    const item = props.chartData[0];
    return {
      avgSteps: item.steps || 0,
      avgCalories: item.calories || 0,
      avgHeartRate: item.avgHeartRate || 0,
      avgStress: item.avgStress || 0,
      avgSleepHours: item.sleepHours || 0
    };
  }
});

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
</script>

<style scoped>
.data-cards-sidebar {
  width: 100%;
  height: 100%;
  padding: 24px;
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
  background: #e6f7ff;
  color: #1890ff;
}

.card-icon.calories {
  background: #f6ffed;
  color: #52c41a;
}

.card-icon.heartrate {
  background: #fff1f0;
  color: #ff4d4f;
}

.card-icon.stress {
  background: #f9f0ff;
  color: #722ed1;
}

.card-icon.sleep {
  background: #fff7e6;
  color: #fa8c16;
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
</style>

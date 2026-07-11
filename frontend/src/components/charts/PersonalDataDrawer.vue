<template>
  <el-drawer
    v-model="drawerVisible"
    :title="t('personal.title')"
    direction="rtl"
    size="600px"
    @close="handleClose"
  >
    <div class="drawer-content">
      <!-- Loading state -->
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="8" animated />
      </div>

      <!-- Content -->
      <div v-else-if="profileData" class="content-wrapper">
        <!-- Basic Info Section -->
        <div class="section">
          <h3 class="section-title">{{ t('personal.basicInfo') }}</h3>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-icon">📏</div>
              <div class="info-content">
                <div class="info-label">{{ t('personal.height') }}</div>
                <div class="info-value">{{ profileData.height || '--' }} cm</div>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon">⚖️</div>
              <div class="info-content">
                <div class="info-label">{{ t('personal.weight') }}</div>
                <div class="info-value">{{ profileData.weight || '--' }} kg</div>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon">🎂</div>
              <div class="info-content">
                <div class="info-label">{{ t('personal.age') }}</div>
                <div class="info-value">{{ profileData.age || '--' }} {{ t('personal.years') }}</div>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon">👤</div>
              <div class="info-content">
                <div class="info-label">{{ t('personal.sex') }}</div>
                <div class="info-value">{{ profileData.sex === 'male' ? t('personal.male') : t('personal.female') }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Weight Goals Section -->
        <div class="section">
          <h3 class="section-title">{{ t('personal.weightGoals') }}</h3>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-icon">🎯</div>
              <div class="info-content">
                <div class="info-label">{{ t('personal.initialWeight') }}</div>
                <div class="info-value">{{ profileData.initialWeight ? profileData.initialWeight + ' kg' : t('personal.notSet') }}</div>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon">🎯</div>
              <div class="info-content">
                <div class="info-label">{{ t('personal.targetWeight') }}</div>
                <div class="info-value">{{ profileData.targetWeight ? profileData.targetWeight + ' kg' : t('personal.notSet') }}</div>
              </div>
            </div>

            <div class="info-item" v-if="profileData.initialWeight && profileData.targetWeight">
              <div class="info-icon">📊</div>
              <div class="info-content">
                <div class="info-label">{{ t('personal.weightToLose') }}</div>
                <div class="info-value">{{ (profileData.initialWeight - profileData.targetWeight).toFixed(1) }} kg</div>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon">🔥</div>
              <div class="info-content">
                <div class="info-label">{{ t('personal.dailyCalGoal') }}</div>
                <div class="info-value">{{ profileData.dailyCalGoal ? profileData.dailyCalGoal + ' kcal' : t('personal.notSet') }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- BMI & Health Metrics Section -->
        <div class="section">
          <h3 class="section-title">{{ t('personal.healthMetrics') }}</h3>
          <div class="metrics-cards">
            <!-- BMI Card -->
            <div class="metric-card bmi-card">
              <div class="metric-header">
                <span class="metric-icon">📐</span>
                <span class="metric-label">{{ t('personal.bmi') }}</span>
              </div>
              <div class="metric-value">{{ profileData.bmi || '--' }}</div>
              <div class="metric-status" :class="bmiCategoryClass">
                {{ bmiCategoryText }}
              </div>
            </div>

            <!-- BMR Card -->
            <div class="metric-card bmr-card">
              <div class="metric-header">
                <span class="metric-icon">🔥</span>
                <span class="metric-label">{{ t('personal.bmr') }}</span>
              </div>
              <div class="metric-value">{{ profileData.bmr || '--' }}</div>
              <div class="metric-unit">{{ t('personal.kcalPerDay') }}</div>
            </div>

            <!-- VO2Max Card -->
            <div class="metric-card vo2max-card" v-if="profileData.vo2Max">
              <div class="metric-header">
                <span class="metric-icon">💪</span>
                <span class="metric-label">{{ t('personal.vo2Max') }}</span>
              </div>
              <div class="metric-value">{{ profileData.vo2Max }}</div>
              <div class="metric-unit">ml/kg/min</div>
            </div>
          </div>
        </div>

        <!-- BMI Reference Chart -->
        <div class="section" v-if="profileData.bmiReference">
          <h3 class="section-title">{{ t('personal.bmiReference') }}</h3>
          <PersonalDataChart :profile-data="profileData" />
        </div>
      </div>

      <!-- Empty state -->
      <el-empty v-else :description="t('personal.noData')" />
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useLocaleStore } from '../../stores/localeStore.js';
import PersonalDataChart from './PersonalDataChart.vue';

const localeStore = useLocaleStore();
const { t } = localeStore;

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  profileData: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:visible', 'close']);

const drawerVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
});

// BMI category text
const bmiCategoryText = computed(() => {
  if (!props.profileData || !props.profileData.bmi) return '';
  const bmi = props.profileData.bmi;
  if (bmi < 18.5) return t('personal.bmiUnderweight');
  if (bmi < 24) return t('personal.bmiNormal');
  if (bmi < 28) return t('personal.bmiOverweight');
  return t('personal.bmiObese');
});

// BMI category class for styling
const bmiCategoryClass = computed(() => {
  if (!props.profileData || !props.profileData.bmi) return '';
  const bmi = props.profileData.bmi;
  if (bmi < 18.5) return 'status-underweight';
  if (bmi < 24) return 'status-normal';
  if (bmi < 28) return 'status-overweight';
  return 'status-obese';
});

function handleClose() {
  emit('close');
}
</script>

<style scoped>
.drawer-content {
  padding: 20px;
}

.loading-container {
  padding: 20px;
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.08), rgba(24, 144, 255, 0.03));
  border-radius: 10px;
  border: 1px solid rgba(24, 144, 255, 0.15);
  transition: all 0.3s ease;
}

.info-item:hover {
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.12), rgba(24, 144, 255, 0.06));
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.info-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(24, 144, 255, 0.1);
  border-radius: 8px;
  flex-shrink: 0;
}

.info-content {
  flex: 1;
}

.info-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.info-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.metrics-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.metric-card {
  padding: 16px;
  border-radius: 10px;
  text-align: center;
  transition: all 0.3s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.bmi-card {
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.1), rgba(114, 46, 209, 0.05));
  border: 1px solid rgba(114, 46, 209, 0.2);
}

.bmr-card {
  background: linear-gradient(135deg, rgba(255, 121, 63, 0.1), rgba(255, 121, 63, 0.05));
  border: 1px solid rgba(255, 121, 63, 0.2);
}

.vo2max-card {
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.1), rgba(82, 196, 26, 0.05));
  border: 1px solid rgba(82, 196, 26, 0.2);
}

.metric-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 8px;
}

.metric-icon {
  font-size: 20px;
}

.metric-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 8px 0;
}

.metric-unit {
  font-size: 12px;
  color: var(--text-secondary);
}

.metric-status {
  font-size: 13px;
  font-weight: 500;
  margin-top: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
}

.status-underweight {
  background: rgba(24, 144, 255, 0.15);
  color: #1890ff;
}

.status-normal {
  background: rgba(82, 196, 26, 0.15);
  color: #52c41a;
}

.status-overweight {
  background: rgba(250, 140, 22, 0.15);
  color: #fa8c16;
}

.status-obese {
  background: rgba(255, 77, 79, 0.15);
  color: #ff4d4f;
}
</style>

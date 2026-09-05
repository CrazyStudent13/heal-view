<template>
  <div class="personal-data-view">
    <!-- Loading state -->
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="10" animated />
    </div>

    <!-- Content -->
    <div v-else-if="profileData" class="content-wrapper">
      <!-- Basic Info -->
      <div class="info-section">
        <SectionTitle>{{ t('personal.basicInfo') }}</SectionTitle>
        <el-descriptions :column="2" border size="large">
          <el-descriptions-item>
            <template #label>{{ t('personal.height') }} / {{ t('personal.weight') }}</template>
            {{ profileData.height || '--' }} cm / {{ profileData.weight || '--' }} kg
          </el-descriptions-item>
          <el-descriptions-item :label="t('personal.sex')">
            {{ profileData.sex === 'male' ? t('personal.male') : t('personal.female') }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('personal.age')">
            {{ profileData.age || '--' }} {{ t('personal.years') }}
          </el-descriptions-item>
          <el-descriptions-item>
            <template #label>
              <span class="label-with-icon">
                {{ t('personal.bmi') }}
                <el-tooltip :content="bmiTooltipContent" placement="top" raw-content>
                  <el-icon class="help-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <span class="bmi-value-row">
              {{ profileData.bmi || '--' }}
              <el-tag v-if="profileData.bmi" :type="bmiTagType" size="small">{{ bmiCategory }}</el-tag>
            </span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('personal.bmr')" :span="2">
            {{ profileData.bmr || '--' }} {{ t('personal.kcalPerDay') }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- Blood pressure -->
      <div v-if="bloodPressureSummary" class="blood-pressure-section">
        <div :class="['blood-pressure-card', bloodPressureStatusClass]">
          <div class="blood-pressure-head">
            <div class="blood-pressure-title">{{ t('personal.bloodPressureTitle') }}</div>
            <el-tag :type="bloodPressureTagType" size="small" effect="light">
              {{ bloodPressureStatusLabel }}
            </el-tag>
          </div>

          <div class="blood-pressure-line">
            <div class="blood-pressure-summary">
              <span class="blood-pressure-value">{{ bloodPressureSummary.latestSystolic }}/{{ bloodPressureSummary.latestDiastolic }}</span>
              <span class="blood-pressure-unit">mmHg</span>
              <span class="blood-pressure-inline-meta">
                {{ t('personal.bloodPressureSummary', {
                  count: bloodPressureSummary.count,
                  heartRate: bloodPressureSummary.latestHeartRate || '--'
                }) }}
              </span>
            </div>
            <el-button
              link
              type="primary"
              class="blood-pressure-toggle"
              @click="showBloodPressureRecords = !showBloodPressureRecords"
            >
              {{ showBloodPressureRecords ? t('personal.bpCollapseRecords') : t('personal.bpExpandRecords') }}
            </el-button>
          </div>

          <transition name="bp-expand">
            <div v-if="showBloodPressureRecords" class="blood-pressure-records">
              <div v-for="record in bloodPressureRecords" :key="record.time" class="blood-pressure-record">
                <div class="record-time">{{ formatTime(record.time) }}</div>
                <div class="record-value">{{ record.systolic }}/{{ record.diastolic }} <span>mmHg</span></div>
                <div class="record-meta">
                  <div v-if="record.heartRate !== null" class="record-heart-rate">
                    {{ t('personal.bloodPressureHeartRate', { heartRate: record.heartRate }) }}
                  </div>
                  <el-tag :type="bloodPressureStatusType(record)" size="small" effect="light">
                    {{ bloodPressureStatusLabelFor(record) }}
                  </el-tag>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- Weight Goals -->
      <div class="info-section">
        <SectionTitle>{{ t('personal.weightGoals') }}</SectionTitle>
        <el-descriptions :column="2" border size="large">
          <el-descriptions-item :label="t('personal.initialWeight')">
            {{ profileData.initialWeight ? profileData.initialWeight + ' kg' : t('personal.notSet') }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('personal.targetWeight')">
            {{ profileData.targetWeight ? profileData.targetWeight + ' kg' : t('personal.notSet') }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="profileData.initialWeight && profileData.targetWeight"
            :label="t('personal.weightToLose')">
            {{ (profileData.initialWeight - profileData.targetWeight).toFixed(1) }} kg
          </el-descriptions-item>
          <el-descriptions-item :label="t('personal.dailyCalGoal')">
            {{ profileData.dailyCalGoal ? profileData.dailyCalGoal + ' kcal' : t('personal.notSet') }}
          </el-descriptions-item>
          <el-descriptions-item v-if="profileData.vo2Max" :label="t('personal.vo2Max')">
            {{ profileData.vo2Max }} ml/kg/min
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>

    <!-- Empty state -->
    <el-empty v-else :description="t('personal.noData')" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore.js';

const localeStore = useLocaleStore();
const { t } = localeStore;

const props = defineProps({
  profileData: {
    type: Object,
    default: null
  },
  chartData: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const showBloodPressureRecords = ref(true);

const bloodPressureSummary = computed(() => {
  const item = props.chartData?.[0];
  if (!item || !Number(item.bloodPressureCount || 0)) return null;

  const records = Array.isArray(item.bloodPressureRecords) ? item.bloodPressureRecords : [];
  const latest = item.latestBloodPressure || records[records.length - 1] || null;
  return {
    count: Number(item.bloodPressureCount || records.length || 0),
    latestSystolic: Number(latest?.systolic || item.avgSystolic || 0),
    latestDiastolic: Number(latest?.diastolic || item.avgDiastolic || 0),
    latestHeartRate: latest?.heartRate ?? null,
    records
  };
});

const bloodPressureRecords = computed(() => {
  return bloodPressureSummary.value?.records || [];
});

function bloodPressureStatus(record = bloodPressureSummary.value) {
  if (!record) return 'normal';
  const systolic = Number(record.latestSystolic ?? record.systolic ?? 0);
  const diastolic = Number(record.latestDiastolic ?? record.diastolic ?? 0);
  if (systolic >= 140 || diastolic >= 90) return 'high';
  if (systolic >= 130 || diastolic >= 85) return 'elevated';
  return 'normal';
}

const bloodPressureStatusLabel = computed(() => {
  const status = bloodPressureStatus();
  return status === 'high'
    ? t('personal.bpHigh')
    : status === 'elevated'
      ? t('personal.bpElevated')
      : t('personal.bpNormal');
});

const bloodPressureTagType = computed(() => {
  const status = bloodPressureStatus();
  if (status === 'high') return 'danger';
  if (status === 'elevated') return 'warning';
  return 'success';
});

const bloodPressureStatusClass = computed(() => `bp-${bloodPressureStatus()}`);

function bloodPressureStatusType(record) {
  const status = bloodPressureStatus(record);
  if (status === 'high') return 'danger';
  if (status === 'elevated') return 'warning';
  return 'success';
}

function bloodPressureStatusLabelFor(record) {
  const status = bloodPressureStatus(record);
  if (status === 'high') return t('personal.bpHigh');
  if (status === 'elevated') return t('personal.bpElevated');
  return t('personal.bpNormal');
}

function formatTime(value) {
  if (value === null || value === undefined || value === '') return '--';
  const date = new Date(Number(value) * 1000);
  if (Number.isNaN(date.getTime())) return '--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// BMI tooltip with reference table (same pattern as WeightChart)
const bmiTooltipContent = computed(() => {
  const ref = props.profileData?.bmiReference;
  if (!ref) return '';

  return `<div style="line-height:1.8">
    ${t('weight.bmiFormula')} &nbsp; ${t('weight.bmiDesc')}（${ref.userHeight}cm）
    <table style="margin-top:6px;border-collapse:collapse;width:100%;text-align:center">
      <tr>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;background:#1890ff;color:#fff;font-weight:600">${t('weight.bmiUnderweight')}</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;background:#52c41a;color:#fff;font-weight:600">${t('weight.bmiNormal')}</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;background:#fa8c16;color:#fff;font-weight:600">${t('weight.bmiOverweight')}</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;background:#ff4d4f;color:#fff;font-weight:600">${t('weight.bmiObese')}</td>
      </tr>
      <tr>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#1890ff">&lt;18.5</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#52c41a">18.5-24</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#fa8c16">24-28</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#ff4d4f">≥28</td>
      </tr>
      <tr>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#1890ff">&lt; ${ref.underweight.weight}kg</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#52c41a">${ref.underweight.weight}-${ref.normal.weight}kg</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#fa8c16">${ref.normal.weight}-${ref.overweight.weight}kg</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#ff4d4f">&gt; ${ref.overweight.weight}kg</td>
      </tr>
    </table>
  </div>`;
});

// BMI category label for tag display
const bmiCategory = computed(() => {
  const bmi = props.profileData?.bmi;
  if (!bmi) return '';
  if (bmi < 18.5) return t('personal.bmiUnderweight');
  if (bmi < 24) return t('personal.bmiNormal');
  if (bmi < 28) return t('personal.bmiOverweight');
  return t('personal.bmiObese');
});

// Element Plus tag type: primary(blue) / success(green) / warning(orange) / danger(red)
const bmiTagType = computed(() => {
  const bmi = props.profileData?.bmi;
  if (!bmi) return 'info';
  if (bmi < 18.5) return 'primary';
  if (bmi < 24) return 'success';
  if (bmi < 28) return 'warning';
  return 'danger';
});
</script>

<style scoped>
.personal-data-view {
  height: 100%;
  overflow-y: auto;
}

.loading-container {
  padding: 20px;
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-title {
  margin: 0 0 24px 0;
  font-size: 18px;
  color: var(--text-primary);
  font-weight: 600;
  text-align: left;
}

.info-section {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 2px solid var(--card-border);
}

.blood-pressure-section {
  margin-top: -8px;
}

.blood-pressure-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-left-width: 4px;
  border-radius: 8px;
  padding: 12px 14px 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.blood-pressure-card.bp-normal {
  border-left-color: #67c23a;
}

.blood-pressure-card.bp-elevated {
  border-left-color: #e6a23c;
}

.blood-pressure-card.bp-high {
  border-left-color: #f56c6c;
}

.blood-pressure-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.blood-pressure-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.blood-pressure-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.blood-pressure-summary {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.blood-pressure-value {
  font-size: 20px;
  line-height: 1;
  font-weight: 700;
  color: var(--text-primary);
}

.blood-pressure-unit {
  font-size: 13px;
  color: var(--text-secondary);
}

.blood-pressure-inline-meta {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.blood-pressure-toggle {
  padding: 0;
  height: auto;
  font-size: 12px;
  flex-shrink: 0;
}

.blood-pressure-records {
  margin-top: 10px;
  border-top: 1px solid var(--card-border);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.blood-pressure-record {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--card-border);
}

.blood-pressure-record:last-child {
  border-bottom: 0;
  padding-bottom: 2px;
}

.record-time {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}

.record-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.record-value span {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.record-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: end;
}

.record-heart-rate {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.bp-expand-enter-active,
.bp-expand-leave-active {
  transition: all 0.2s ease;
}

.bp-expand-enter-from,
.bp-expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 统一两个表格的标签列宽度，让分割线对齐 */
.info-section :deep(.el-descriptions__body table) {
  table-layout: fixed;
}
.info-section :deep(.el-descriptions__body col:first-of-type) {
  width: 100px;
}

.help-icon {
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 14px;
}

.label-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.bmi-value-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>

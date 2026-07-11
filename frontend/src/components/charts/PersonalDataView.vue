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
        <h3 class="section-title">{{ t('personal.basicInfo') }}</h3>
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

      <!-- Weight Goals -->
      <div class="info-section">
        <h3 class="section-title">{{ t('personal.weightGoals') }}</h3>
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
import { computed } from 'vue';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore.js';

const localeStore = useLocaleStore();
const { t } = localeStore;

const props = defineProps({
  profileData: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
});

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

.section-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: var(--text-primary);
  font-weight: 600;
}

.info-section {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
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

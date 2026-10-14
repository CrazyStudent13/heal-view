<template>
  <el-dialog
    :model-value="modelValue"
    class="phase-review-dialog"
    :title="dialogTitle"
    width="min(640px, calc(100vw - 32px))"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top" @submit.prevent>
      <el-form-item :label="t('plans.manager.reviewSummary')">
        <el-input v-model="phaseReviewForm.summary" type="textarea" :rows="3" maxlength="4000" show-word-limit />
      </el-form-item>
      <el-form-item>
        <template #label>
          <span class="fatigue-form-label">
            {{ t('plans.manager.reviewFatigue') }}
            <el-tooltip
              :content="t('plans.manager.reviewFatigueHint')"
              placement="top-start"
              popper-class="fatigue-hint-tooltip"
            >
              <el-icon class="fatigue-help-icon" :aria-label="t('plans.manager.reviewFatigueHint')" tabindex="0">
                <QuestionFilled />
              </el-icon>
            </el-tooltip>
          </span>
        </template>
        <div class="fatigue-rating-field">
          <div class="fatigue-rating-control">
            <el-rate v-model="phaseReviewForm.fatigueLevel" :max="10" :texts="fatigueRatingTexts" show-text />
          </div>
          <el-alert
            v-if="highFatigue"
            class="fatigue-high-alert"
            type="warning"
            :title="t('plans.manager.reviewHighFatigueHint')"
            :closable="false"
            show-icon
          />
        </div>
      </el-form-item>
      <el-form-item :required="highFatigue" :label="t('plans.manager.reviewDiscomfort')">
        <el-input v-model="phaseReviewForm.discomfort" type="textarea" :rows="2" maxlength="2000" show-word-limit />
      </el-form-item>
      <el-form-item :required="highFatigue" :label="t('plans.manager.reviewAdjustment')">
        <el-input v-model="phaseReviewForm.adjustment" type="textarea" :rows="2" maxlength="2000" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="saving" @click="submitReview">{{ t('common.save') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 要复盘的计划阶段。 */
  phase: { type: Object, default: null },
  planName: { type: String, default: '' },
  saving: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue', 'submit']);

const { t } = useLocaleStore();
const phaseReviewForm = reactive({
  phaseId: null,
  summary: '',
  fatigueLevel: null,
  discomfort: '',
  adjustment: ''
});

const dialogTitle = computed(() =>
  props.planName ? t('plans.manager.reviewDialogTitle', { name: props.planName }) : t('plans.manager.phaseReviews')
);
const fatigueRatingTexts = computed(() => [
  t('plans.manager.fatigueRatingLow'),
  t('plans.manager.fatigueRatingMedium'),
  t('plans.manager.fatigueRatingHigh')
]);
const highFatigue = computed(() => Number(phaseReviewForm.fatigueLevel) > 6);

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) initializeForm();
  },
  { immediate: true }
);

function initializeForm() {
  const phase = props.phase;
  if (!phase) return;
  Object.assign(phaseReviewForm, {
    phaseId: phase.id,
    summary: phase.review?.summary || '',
    fatigueLevel: phase.review?.fatigueLevel ?? null,
    discomfort: phase.review?.discomfort || '',
    adjustment: phase.review?.adjustment || ''
  });
}

/** 高疲劳必须留下不适和调整记录，这是复盘真正的用处所在。 */
function submitReview() {
  if (!phaseReviewForm.phaseId) return;
  if (highFatigue.value && !phaseReviewForm.discomfort.trim()) {
    ElMessage.warning(t('plans.manager.reviewDiscomfortRequired'));
    return;
  }
  if (highFatigue.value && !phaseReviewForm.adjustment.trim()) {
    ElMessage.warning(t('plans.manager.reviewAdjustmentRequired'));
    return;
  }
  emit('submit', {
    phaseId: phaseReviewForm.phaseId,
    summary: phaseReviewForm.summary,
    fatigueLevel: phaseReviewForm.fatigueLevel,
    discomfort: phaseReviewForm.discomfort,
    adjustment: phaseReviewForm.adjustment
  });
}
</script>

<style scoped lang="scss">
.fatigue-rating-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fatigue-form-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

:global(.fatigue-hint-tooltip) {
  white-space: pre-line;
}

.fatigue-rating-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.fatigue-rating-control :deep(.el-rate) {
  height: 32px;
}

.fatigue-rating-control :deep(.el-rate__icon) {
  margin-right: 3px;
  font-size: 24px;
}

.fatigue-rating-control :deep(.el-rate__text) {
  min-width: 66px;
  color: var(--text-secondary);
  font-size: 12px;
}

.fatigue-help-icon {
  color: var(--text-secondary);
  font-size: 16px;
  cursor: help;
}

.fatigue-help-icon:hover,
.fatigue-help-icon:focus-visible {
  color: var(--primary-color);
  outline: none;
}

.fatigue-high-alert {
  max-width: 520px;
  margin-top: 4px;
}

.fatigue-high-alert :deep(.el-alert__title) {
  font-size: 12px;
  line-height: 1.5;
}
</style>

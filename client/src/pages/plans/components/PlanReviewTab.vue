<template>
  <section v-if="planReviewPhase" class="plan-review-section">
    <header class="section-heading">
      <div>
        <h4 class="plan-review-heading">
          <span>{{ t('plans.manager.phaseReviews') }}</span>
          <el-tooltip :content="planWeightHint" placement="top">
            <el-tag size="small" effect="plain" :type="planWeightChangeTagType">
              {{ t('plans.manager.reviewWeightChange') }}：{{ planWeightChangeLabel }}
            </el-tag>
          </el-tooltip>
        </h4>
        <p>{{ t('plans.manager.phaseReviewsDescription') }}</p>
      </div>
      <el-button type="primary" plain :icon="EditPen" @click="emit('edit-review', planReviewPhase)">
        {{ planReviewPhase.review ? t('plans.manager.editReview') : t('plans.manager.addReview') }}
      </el-button>
    </header>

    <article class="plan-review-card">
      <div class="plan-review-card__meta">
        <div>
          <h5>{{ plan.name }}</h5>
          <p>{{ plan.startDate }} - {{ plan.endDate }}</p>
        </div>
        <el-tag size="small" :type="lifecycleTagType(plan.lifecycle)">{{ lifecycleLabel(plan.lifecycle) }}</el-tag>
      </div>
      <div class="phase-review-summary plan-review-summary">
        <span>{{ t('plans.manager.reviewTotal') }}：{{ planReviewSummary.total }}</span>
        <span class="phase-review-summary__success"
          >{{ t('plans.manager.reviewAchieved') }}：{{ planReviewSummary.achieved }}</span
        >
        <span>{{ t('plans.manager.reviewPartial') }}：{{ planReviewSummary.partial }}</span>
        <span>{{ t('plans.manager.reviewUnverifiable') }}：{{ planReviewSummary.unverifiable }}</span>
      </div>
      <div v-if="hasVerifiableItems" class="phase-review-summary plan-review-summary">
        <span
          >{{ t('plans.manager.coverageRate') }}：{{ coverageRateText }}（{{ coverage.matchedItems }}/{{
            coverage.verifiableItems
          }}）</span
        >
        <span
          >{{ t('plans.manager.verifiableCompletionRate') }}：{{ verifiableCompletionRateText }}（{{
            coverage.achievedItems
          }}/{{ coverage.matchedItems }}）</span
        >
      </div>
      <div v-if="planReviewPhase.review" class="phase-review-content plan-review-content">
        <p v-if="planReviewPhase.review.summary">
          <strong>{{ t('plans.manager.reviewSummary') }}</strong
          >{{ planReviewPhase.review.summary }}
        </p>
        <p v-if="planReviewPhase.review.discomfort">
          <strong>{{ t('plans.manager.reviewDiscomfort') }}</strong
          >{{ planReviewPhase.review.discomfort }}
        </p>
        <p v-if="planReviewPhase.review.adjustment">
          <strong>{{ t('plans.manager.reviewAdjustment') }}</strong
          >{{ planReviewPhase.review.adjustment }}
        </p>
        <span v-if="planReviewPhase.review.fatigueLevel !== null && planReviewPhase.review.fatigueLevel !== undefined">
          {{ t('plans.manager.reviewFatigue') }}：{{ planReviewPhase.review.fatigueLevel }}/10
        </span>
      </div>
      <el-empty v-else :description="t('plans.manager.noReview')" :image-size="52" />
    </article>
  </section>
  <el-empty v-else :description="t('plans.manager.noPhases')" :image-size="64" />
</template>

<script setup>
import { computed, toRef } from 'vue';
import { EditPen } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import { usePlanLabels } from '@/pages/plans/composables/usePlanLabels.js';
import { usePlanCoverage } from '@/pages/plans/composables/usePlanProgress.js';

const props = defineProps({
  plan: { type: Object, default: null },
  /** 计划区间内的体重数据，用来在复盘里带一句体重变化。 */
  weightData: { type: Object, default: null }
});
const emit = defineEmits(['edit-review']);

const { t } = useLocaleStore();
const { lifecycleLabel, lifecycleTagType } = usePlanLabels();
const planRef = toRef(props, 'plan');
const { coverage, hasVerifiableItems, coverageRateText, verifiableCompletionRateText } = usePlanCoverage(planRef);

const planReviewPhase = computed(() => {
  const phases = props.plan?.phases || [];
  return phases.find((phase) => phase.review) || phases[0] || null;
});
const planReviewSummary = computed(() => {
  const summary = { total: 0, achieved: 0, partial: 0, unverifiable: 0 };
  for (const session of props.plan?.sessions || []) {
    summary.total += 1;
    if (Object.prototype.hasOwnProperty.call(summary, session.status)) summary[session.status] += 1;
  }
  return summary;
});
const planWeightSummary = computed(() => {
  const dailyData = props.weightData?.dailyData || [];
  if (dailyData.length === 0) return null;
  const firstItem = dailyData[0];
  const lastItem = dailyData[dailyData.length - 1];
  const first = Number(firstItem?.avgWeight);
  const last = Number(lastItem?.avgWeight);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  return {
    first,
    last,
    firstDate: firstItem.date,
    lastDate: lastItem.date,
    change: dailyData.length >= 2 ? Number((last - first).toFixed(1)) : null
  };
});
const planWeightChange = computed(() => planWeightSummary.value?.change ?? null);
const planWeightChangeLabel = computed(() => {
  const summary = planWeightSummary.value;
  if (!summary) return t('plans.manager.reviewWeightUnavailable');
  if (summary.change === null) return `${summary.first.toFixed(1)} kg`;
  const prefix = planWeightChange.value > 0 ? '+' : '';
  return `${summary.first.toFixed(1)} → ${summary.last.toFixed(1)} kg (${prefix}${summary.change.toFixed(1)} kg)`;
});
const planWeightHint = computed(() => {
  const summary = planWeightSummary.value;
  if (!summary) return t('plans.manager.reviewWeightUnavailable');
  if (summary.change === null) {
    return t('plans.manager.reviewWeightSingleHint', { date: summary.firstDate });
  }
  return t('plans.manager.reviewWeightHint', { startDate: summary.firstDate, endDate: summary.lastDate });
});
const planWeightChangeTagType = computed(() => {
  if (planWeightChange.value === null || planWeightChange.value === 0) return 'info';
  return planWeightChange.value < 0 ? 'success' : 'warning';
});
</script>

<style scoped lang="scss">
h4,
p {
  margin: 0;
}

.plan-review-section {
  padding: 18px 0 20px;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.section-heading h4 {
  color: var(--text-primary);
  font-size: 16px;
  letter-spacing: 0;
}

.section-heading p {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}

.plan-review-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.plan-review-heading :deep(.el-tag) {
  font-weight: 500;
}

.plan-review-heading :deep(.el-tooltip__trigger) {
  display: inline-flex;
}

.plan-review-card {
  margin-top: 14px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 26%, var(--card-border));
  border-left: 3px solid var(--primary-color);
  border-radius: 6px;
  background: color-mix(in srgb, var(--primary-color) 4%, var(--card-bg));
}

.plan-review-card__meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.plan-review-card__meta h5 {
  color: var(--text-primary);
  font-size: 14px;
  letter-spacing: 0;
}

.plan-review-card__meta p {
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.plan-review-card .phase-review-summary {
  margin-top: 12px;
}

.plan-review-card .phase-review-content {
  margin-top: 12px;
  padding-top: 12px;
}

.phase-review-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 12px;
  margin-top: 14px;
  color: var(--text-secondary);
  font-size: 12px;
}

.phase-review-summary__success {
  color: var(--el-color-success);
}

.phase-review-content {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--card-border);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.phase-review-content p {
  flex: 0 0 100%;
  margin: 0;
  white-space: pre-wrap;
}

.phase-review-content strong {
  margin-right: 5px;
  color: var(--text-primary);
  font-weight: 600;
}

.plan-review-card > .el-empty {
  padding: 16px 0 4px;
}

@media (max-width: 640px) {
  .section-heading,
  .plan-review-card__meta {
    flex-direction: column;
  }
}
</style>

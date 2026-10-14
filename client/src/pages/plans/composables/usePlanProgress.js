import { computed } from 'vue';
import { useLocaleStore } from '@/stores/localeStore.js';

const EMPTY_COVERAGE = {
  verifiableItems: 0,
  matchedItems: 0,
  coverageRate: null,
  achievedItems: 0,
  partialItems: 0,
  verifiableCompletionRate: null
};

/**
 * 计划的达成度与覆盖率展示。
 *
 * 达成度是打卡口径（加练算补充履约），覆盖率说明「多少项目真的能验证」，
 * 可验证完成率只在有数据的项目上算。列表、训练日历和计划反馈必须共用同一套口径，
 * 否则同一个计划在两处会给出不一样的说法。
 */
export function usePlanProgress() {
  const { t } = useLocaleStore();

  function adherenceOf(plan) {
    return (
      plan?.adherence || {
        eligibleDays: 0,
        fulfilledDays: 0,
        extraDays: 0,
        completedDays: 0,
        rate: null,
        tier: null
      }
    );
  }

  /** 百分比保留一位小数，避免四舍五入后被误读成另一个档位。 */
  function formatPercent(rate) {
    if (rate === null || rate === undefined || !Number.isFinite(Number(rate))) return null;
    return `${(Number(rate) * 100).toFixed(1)}%`;
  }

  function formatRate(rate) {
    if (rate === null || rate === undefined) return '--';
    return `${Math.round(rate * 100)}%`;
  }

  /** 达成度主文案：比率 + 分数，缺一不可。分母为 0 时显示「暂无」。 */
  function adherenceRateText(plan) {
    const adherence = adherenceOf(plan);
    const percent = formatPercent(adherence.rate);
    if (percent === null) return t('plans.manager.adherence.pending');
    // 走 i18n 模板而不是在 JS 里拼串，列表和详情共用同一份格式。
    return t('plans.manager.adherence.rate', {
      rate: percent,
      completed: adherence.completedDays,
      eligible: adherence.eligibleDays
    });
  }

  function adherenceTierLabel(tier) {
    return tier ? t(`plans.manager.adherence.tiers.${tier}`) : '';
  }

  /** 档位只对已结束的计划显示：进行中的计划还没到评价的时候。 */
  function showAdherenceTier(plan) {
    return plan?.lifecycle === 'ended' && Boolean(adherenceOf(plan).tier);
  }

  function adherenceDetailText(plan) {
    const adherence = adherenceOf(plan);
    const parts = [];
    if (showAdherenceTier(plan)) parts.push(adherenceTierLabel(adherence.tier));
    if (adherence.extraDays > 0) {
      parts.push(t('plans.manager.adherence.extraDays', { count: adherence.extraDays }));
    }
    return parts.join(t('plans.manager.matchDetailSeparator'));
  }

  function adherenceTooltip(plan) {
    const adherence = adherenceOf(plan);
    if (adherence.extraDays <= 0) return '';
    const dates = (plan?.extraTrainingDates || []).join(t('common.listSeparator'));
    return t('plans.manager.adherence.extraDaysHint', { dates });
  }

  /**
   * 计划名称的配色只表达生命周期，不再依赖已经删除的 status：
   * 已归档最淡，已结束但没练过任何一天算"落空"，进行中正常高亮。
   */
  function planProgressClass(plan) {
    if (plan?.archived) return 'plan-cell-name--archived';
    if (plan?.lifecycle === 'active') return 'plan-cell-name--active';
    if (plan?.lifecycle === 'ended') {
      const adherence = adherenceOf(plan);
      return adherence.completedDays > 0 ? 'plan-cell-name--completed' : 'plan-cell-name--incomplete';
    }
    return '';
  }

  function extraTrainingDatesText(plan) {
    const dates = (plan?.extraTrainingDates || []).join(t('common.listSeparator'));
    return dates ? t('plans.manager.adherence.extraDaysHint', { dates }) : '';
  }

  return {
    adherenceOf,
    formatPercent,
    formatRate,
    adherenceRateText,
    adherenceTierLabel,
    showAdherenceTier,
    adherenceDetailText,
    adherenceTooltip,
    planProgressClass,
    extraTrainingDatesText
  };
}

/** 覆盖率相关的派生值：训练日历和计划反馈各用一份，口径一致（plan 传 ref）。 */
export function usePlanCoverage(plan) {
  const { formatRate } = usePlanProgress();
  const coverage = computed(() => plan.value?.coverage || EMPTY_COVERAGE);
  const hasVerifiableItems = computed(() => coverage.value.verifiableItems > 0);
  const coverageRateText = computed(() => formatRate(coverage.value.coverageRate));
  const verifiableCompletionRateText = computed(() => formatRate(coverage.value.verifiableCompletionRate));
  return { coverage, hasVerifiableItems, coverageRateText, verifiableCompletionRateText };
}

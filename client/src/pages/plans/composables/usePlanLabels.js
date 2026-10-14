import { computed } from 'vue';
import { useLocaleStore } from '@/stores/localeStore.js';

/** 训练课的手动状态顺序：状态下拉和批量加课共用同一份，避免两处排序不一致。 */
export const SESSION_STATUSES = ['planned', 'achieved', 'partial', 'no_data', 'unverifiable', 'skipped'];

/**
 * 计划模块共用的文案与配色：状态标签、生命周期标签、星期选项。
 * 计划页、计划详情和各弹窗都要用同一套，集中在这里以免各自演化。
 */
export function usePlanLabels() {
  const { t } = useLocaleStore();

  function statusLabel(status) {
    return t(`plans.manager.statuses.${status}`);
  }

  function statusTagType(status) {
    if (['active', 'achieved', 'completed'].includes(status)) return 'success';
    if (['paused', 'partial'].includes(status)) return 'warning';
    if (['cancelled', 'skipped', 'missed'].includes(status)) return 'danger';
    return 'info';
  }

  // 生命周期由日期推导，归档是正交的意图位，两者不合成一个标签，所以生命周期单独一对文案。
  function lifecycleLabel(lifecycle) {
    return t(`plans.manager.lifecycles.${lifecycle || 'draft'}`);
  }

  function lifecycleTagType(lifecycle) {
    if (lifecycle === 'active') return 'success';
    if (lifecycle === 'ended') return 'info';
    return 'warning';
  }

  const weekdayOptions = computed(() => [
    { value: 1, label: t('plans.manager.weekdays.mon') },
    { value: 2, label: t('plans.manager.weekdays.tue') },
    { value: 3, label: t('plans.manager.weekdays.wed') },
    { value: 4, label: t('plans.manager.weekdays.thu') },
    { value: 5, label: t('plans.manager.weekdays.fri') },
    { value: 6, label: t('plans.manager.weekdays.sat') },
    { value: 0, label: t('plans.manager.weekdays.sun') }
  ]);

  return { statusLabel, statusTagType, lifecycleLabel, lifecycleTagType, weekdayOptions };
}

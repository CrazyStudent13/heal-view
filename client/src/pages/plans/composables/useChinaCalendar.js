import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getChinaWorkdayCalendar } from '@/api/fitnessApi.js';
import { useLocaleStore } from '@/stores/localeStore.js';
import { normalizeRequestError } from '@/utils/requestState.js';

/** 批量排课的频率选项：两个弹窗共用同一份顺序。 */
export const BATCH_FREQUENCIES = ['daily', 'china_workdays', 'weekdays', 'odd', 'even'];

/**
 * 调休/节假日覆盖。
 * 接口没覆盖到的年份只能退化成「周一到周五算工作日」，这也是提示语要说明的事。
 */
export function isChinaWorkday(date, override) {
  if (override?.type === 'transfer_workday') return true;
  if (override?.type === 'public_holiday') return false;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

/** 按频率把日期区间铺成训练日：频率只决定「哪些日子算训练日」。 */
export function getBatchDates(dateRange, frequency, weekdays, chinaCalendar = new Map()) {
  const [startDate, endDate] = dateRange || [];
  if (!startDate || !endDate || startDate > endDate) return [];
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    const dayOfMonth = cursor.getUTCDate();
    const date = cursor.toISOString().slice(0, 10);
    const calendarDay = chinaCalendar.get(date);
    const matches =
      frequency === 'daily' ||
      (frequency === 'china_workdays' && isChinaWorkday(date, calendarDay)) ||
      (frequency === 'weekdays' && weekdays.includes(day)) ||
      (frequency === 'odd' && dayOfMonth % 2 === 1) ||
      (frequency === 'even' && dayOfMonth % 2 === 0);
    if (matches) dates.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** 拿不到覆盖数据时，把区间覆盖到的年份列出来给用户看。 */
function missingYears(dateRange) {
  const startYear = Number(dateRange?.[0]?.slice(0, 4));
  const endYear = Number(dateRange?.[1]?.slice(0, 4));
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) return [];
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index).filter(Number.isInteger);
}

/**
 * 中国工作日日历的加载与状态。
 * 计划弹窗（批量规则）和批量加课弹窗各持一份：两边的日期区间本来就可能不一样。
 */
export function useChinaCalendar() {
  const { t } = useLocaleStore();
  const chinaCalendar = ref(new Map());
  const chinaCalendarUnavailableYears = ref([]);
  const chinaCalendarLoading = ref(false);

  async function loadChinaCalendar(dateRange) {
    const [startDate, endDate] = dateRange || [];
    if (!startDate || !endDate) return;
    chinaCalendarLoading.value = true;
    chinaCalendarUnavailableYears.value = [];
    try {
      const response = await getChinaWorkdayCalendar({ startDate, endDate });
      chinaCalendar.value = new Map(response.overrides.map((day) => [day.date, day]));
      chinaCalendarUnavailableYears.value = response.unavailableYears || [];
    } catch (requestError) {
      chinaCalendar.value = new Map();
      chinaCalendarUnavailableYears.value = missingYears(dateRange);
      ElMessage.warning(normalizeRequestError(requestError, t) || t('plans.manager.chinaCalendarLoadFailed'));
    } finally {
      chinaCalendarLoading.value = false;
    }
  }

  function unavailableYearsText() {
    return chinaCalendarUnavailableYears.value.join(t('common.listSeparator'));
  }

  return {
    chinaCalendar,
    chinaCalendarUnavailableYears,
    chinaCalendarLoading,
    loadChinaCalendar,
    unavailableYearsText
  };
}

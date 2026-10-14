import { computed, ref, watch } from 'vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import { usePlanProgress } from '@/pages/plans/composables/usePlanProgress.js';

const BACKFILL_EXCLUDED_STATUSES = ['achieved', 'partial'];

export function todayKey() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');
}

/** 训练日状态：计划里已经过去但没履约的日子算 missed，日历格子和达成度都靠它对齐口径。 */
export function calendarSessionStatus(session) {
  if (!session) return 'planned';
  if (session.status === 'planned' && session.scheduledDate < todayKey()) return 'missed';
  return session.status || 'planned';
}

/**
 * 补卡判定必须和达成度一致：已过期（scheduledDate < 今天）且派生状态不是
 * achieved / partial 的训练日就是缺席，需要用户自己去声明补上。
 * 未到的日子补卡没有意义。
 */
export function sessionNeedsBackfill(session) {
  if (!session?.scheduledDate) return false;
  if (session.scheduledDate >= todayKey()) return false;
  return !BACKFILL_EXCLUDED_STATUSES.includes(calendarSessionStatus(session));
}

/**
 * 训练日历的月份、选中日期和派生格子。
 *
 * plan 传 ref：计划换了（包括同一个计划重新拉取）就回到起始月和第一个训练日。
 * 这两个值原来挂在页面的 loadPlanDetail 里，跟着计划数据走才不会各处漂移。
 */
export function usePlanCalendar(plan) {
  const { t } = useLocaleStore();
  const { adherenceOf, adherenceTierLabel, showAdherenceTier, extraTrainingDatesText } = usePlanProgress();

  const calendarMonth = ref('');
  const calendarSelectedDate = ref('');

  const calendarMonthLabel = computed(() => calendarMonth.value.replace('-', ' / '));
  const selectedSessions = computed(() =>
    (plan.value?.sessions || []).filter((session) => session.scheduledDate === calendarSelectedDate.value)
  );
  const selectedSession = computed(() => selectedSessions.value[0] || null);
  const selectedDateInPlan = computed(() => {
    const current = plan.value;
    return Boolean(
      current &&
        calendarSelectedDate.value &&
        calendarSelectedDate.value >= current.startDate &&
        calendarSelectedDate.value <= current.endDate
    );
  });
  const plannedDays = computed(() => new Set((plan.value?.sessions || []).map((s) => s.scheduledDate)).size);
  const achievedDays = computed(
    () =>
      new Set(
        (plan.value?.sessions || [])
          .filter((session) => calendarSessionStatus(session) === 'achieved')
          .map((session) => session.scheduledDate)
      ).size
  );
  const partialDays = computed(
    () =>
      new Set(
        (plan.value?.sessions || [])
          .filter((session) => calendarSessionStatus(session) === 'partial')
          .map((session) => session.scheduledDate)
      ).size
  );
  const days = computed(() => {
    if (!calendarMonth.value) return [];
    const [year, month] = calendarMonth.value.split('-').map(Number);
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const leadingDays = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
    const sessionsByDate = new Map();
    for (const session of plan.value?.sessions || []) {
      const daySessions = sessionsByDate.get(session.scheduledDate) || [];
      daySessions.push(session);
      sessionsByDate.set(session.scheduledDate, daySessions);
    }
    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - leadingDays + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        return { key: 'empty-' + index, date: '', day: '', sessions: [], inPlan: false };
      }
      const date = calendarMonth.value + '-' + String(dayNumber).padStart(2, '0');
      return {
        key: date,
        date,
        day: dayNumber,
        sessions: sessionsByDate.get(date) || [],
        inPlan: date >= plan.value.startDate && date <= plan.value.endDate
      };
    });
  });
  const canBackfill = computed(() => {
    if (!calendarSelectedDate.value) return false;
    const sessions = selectedSessions.value;
    if (sessions.length === 0) return false;
    return sessions.some((session) => sessionNeedsBackfill(session));
  });

  /**
   * 达成度并进「计划训练日」那一行之后，原来卡片里的档位、加练天数和
   * "暂无可统计训练日"改挂到这个 tooltip 上，换位置不丢信息。
   * 覆盖率有自己的卡片，不在这里重复。
   */
  const adherenceSummaryTooltip = computed(() => {
    const current = plan.value;
    if (!current) return '';
    const adherence = adherenceOf(current);
    const parts = [];
    if (adherence.eligibleDays && adherence.extraDays > 0) {
      parts.push(t('plans.manager.adherence.extraDays', { count: adherence.extraDays }));
      const datesHint = extraTrainingDatesText(current);
      if (datesHint) parts.push(datesHint);
    }
    if (!adherence.eligibleDays) parts.push(t('plans.manager.adherence.empty'));
    if (showAdherenceTier(current)) parts.push(adherenceTierLabel(adherence.tier));
    return parts.join(t('plans.manager.matchDetailSeparator'));
  });

  watch(
    plan,
    (value) => {
      if (!value) return;
      calendarMonth.value = value.startDate.slice(0, 7);
      calendarSelectedDate.value = value.sessions?.[0]?.scheduledDate || value.startDate || '';
    },
    { immediate: true }
  );

  function shiftMonth(offset) {
    if (!calendarMonth.value) return;
    const [year, month] = calendarMonth.value.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    calendarMonth.value = next.toISOString().slice(0, 7);
  }

  function selectDate(date) {
    if (!date) return;
    calendarSelectedDate.value = date;
  }

  function dayClass(day) {
    const currentToday = todayKey();
    const statuses = day.sessions.map((session) => calendarSessionStatus(session));
    const hasPartial = statuses.includes('partial');
    const hasAchieved = statuses.includes('achieved');
    const hasMissed = statuses.includes('missed');
    return {
      'calendar-day--empty': !day.date,
      'calendar-day--outside-plan': day.date && !day.inPlan,
      'calendar-day--in-plan': day.inPlan,
      'calendar-day--today': day.date === currentToday,
      'calendar-day--selected': day.date === calendarSelectedDate.value,
      'calendar-day--completed': hasAchieved && !hasPartial && !hasMissed,
      'calendar-day--partial': hasPartial,
      'calendar-day--missed': hasMissed && !hasAchieved && !hasPartial
    };
  }

  function sessionClass(session) {
    return 'calendar-session-chip--' + calendarSessionStatus(session);
  }

  return {
    calendarMonthLabel,
    calendarSelectedDate,
    selectedSessions,
    selectedSession,
    selectedDateInPlan,
    plannedDays,
    achievedDays,
    partialDays,
    days,
    canBackfill,
    adherenceSummaryTooltip,
    shiftMonth,
    selectDate,
    dayClass,
    sessionClass
  };
}

<template>
  <section class="plan-calendar-section">
    <header class="calendar-header">
      <div class="calendar-title">
        <h4>{{ t('plans.manager.calendarTitle') }}</h4>
        <el-tooltip :content="t('plans.manager.calendarDescription')" placement="top">
          <el-icon class="calendar-help-icon" :aria-label="t('plans.manager.calendarDescription')" tabindex="0">
            <QuestionFilled />
          </el-icon>
        </el-tooltip>
      </div>
      <div class="calendar-toolbar">
        <el-radio-group
          v-model="calendarView"
          size="small"
          class="calendar-view-switch"
          :aria-label="t('plans.manager.calendarViewLabel')"
        >
          <el-radio-button value="month">{{ t('plans.manager.viewModeMonth') }}</el-radio-button>
          <el-radio-button value="week">{{ t('plans.manager.viewModeWeek') }}</el-radio-button>
        </el-radio-group>
        <!-- 仅在周视图出现：收起周末两列，五列平分宽度，窄屏也能看清训练内容。 -->
        <el-button
          v-if="calendarView === 'week'"
          size="small"
          class="calendar-weekdays-toggle"
          :type="weekdaysOnly ? 'primary' : ''"
          :aria-pressed="weekdaysOnly"
          @click="weekdaysOnly = !weekdaysOnly"
        >
          {{ t('plans.manager.weekdaysOnly') }}
        </el-button>
        <div class="calendar-navigation">
          <el-tooltip :content="previousRangeLabel" placement="top">
            <el-button circle :icon="ArrowLeft" :aria-label="previousRangeLabel" @click="shiftRange(-1)" />
          </el-tooltip>
          <strong>{{ calendarRangeLabel }}</strong>
          <el-tooltip :content="nextRangeLabel" placement="top">
            <el-button circle :icon="ArrowRight" :aria-label="nextRangeLabel" @click="shiftRange(1)" />
          </el-tooltip>
        </div>
      </div>
    </header>

    <div class="calendar-summary">
      <span>{{ t('plans.manager.calendarPlanDays') }}：{{ plannedDays }}</span>
      <!-- 达成度紧跟在计划训练日后面：分母和比率挨着看才有意义。
                       原来那张卡片里的档位、加练天数和"暂无可统计训练日"改挂在 tooltip 上，信息不丢。 -->
      <el-tooltip :content="adherenceSummaryTooltip" placement="top" :disabled="!adherenceSummaryTooltip">
        <span class="calendar-summary__adherence">
          {{ t('plans.manager.adherence.title') }}：{{ adherenceRateText(plan) }}
        </span>
      </el-tooltip>
      <span class="calendar-summary__completed">{{ t('plans.manager.calendarAchievedDays') }}：{{ achievedDays }}</span>
      <span class="calendar-summary__partial">{{ t('plans.manager.calendarPartialDays') }}：{{ partialDays }}</span>
      <span class="calendar-legend"
        ><i class="calendar-dot calendar-dot--completed"></i>{{ t('plans.manager.statuses.achieved') }}</span
      >
      <span class="calendar-legend"
        ><i class="calendar-dot calendar-dot--partial"></i>{{ t('plans.manager.statuses.partial') }}</span
      >
      <span class="calendar-legend"
        ><i class="calendar-dot calendar-dot--missed"></i>{{ t('plans.manager.statuses.missed') }}</span
      >
    </div>

    <!-- 达成度已经并进上面的训练日摘要行，这里只留数据覆盖率相关卡片。 -->
    <div v-if="hasVerifiableItems" class="plan-coverage">
      <div class="plan-coverage__item">
        <span class="plan-coverage__label">{{ t('plans.manager.coverageRate') }}</span>
        <strong class="plan-coverage__value">{{ coverageRateText }}</strong>
        <small class="plan-coverage__hint">{{
          t('plans.manager.coverageRateHint', {
            matched: coverage.matchedItems,
            verifiable: coverage.verifiableItems
          })
        }}</small>
      </div>
      <div class="plan-coverage__item">
        <span class="plan-coverage__label">{{ t('plans.manager.verifiableCompletionRate') }}</span>
        <strong class="plan-coverage__value">{{ verifiableCompletionRateText }}</strong>
        <small class="plan-coverage__hint">{{
          t('plans.manager.verifiableCompletionRateHint', {
            achieved: coverage.achievedItems,
            matched: coverage.matchedItems
          })
        }}</small>
      </div>
    </div>

    <div class="calendar-workspace">
      <div class="calendar-overview">
        <template v-if="calendarView === 'month'">
          <div class="calendar-weekdays" aria-hidden="true">
            <span v-for="day in weekdayOptions" :key="day.value">{{ day.label }}</span>
          </div>
          <div class="training-calendar-grid">
            <div
              v-for="day in days"
              :key="day.key"
              class="calendar-day"
              :class="dayClass(day)"
              role="button"
              tabindex="0"
              @click="day.date && selectDate(day.date)"
              @keydown.enter="day.date && selectDate(day.date)"
            >
              <template v-if="day.date">
                <time class="calendar-day__number" :datetime="day.date">{{ day.day }}</time>
                <div v-if="day.sessions.length" class="calendar-day__sessions">
                  <span
                    v-for="session in day.sessions.slice(0, 2)"
                    :key="session.id"
                    class="calendar-session-chip"
                    :class="sessionClass(session)"
                  >
                    {{ sessionExercisesText(session) }}
                  </span>
                  <small v-if="day.sessions.length > 2">+{{ day.sessions.length - 2 }}</small>
                </div>
                <span v-else-if="day.inPlan" class="calendar-day__empty">{{
                  t('plans.manager.calendarNoSession')
                }}</span>
              </template>
            </div>
          </div>
        </template>
        <!-- 周课程表：星期抬头放在每列头部，训练单元整卡展示不截断；仅工作日时收起周末两列。 -->
        <div v-else class="training-week-grid" :class="{ 'training-week-grid--weekdays-only': weekdaysOnly }">
          <div
            v-for="day in weekDays"
            :key="day.key"
            class="week-day"
            :class="dayClass(day)"
            role="button"
            tabindex="0"
            @click="selectDate(day.date)"
            @keydown.enter="selectDate(day.date)"
          >
            <header class="week-day__header">
              <span class="week-day__weekday">{{ day.weekday }}</span>
              <time class="week-day__date" :datetime="day.date">{{ day.day }}</time>
              <span v-if="isToday(day.date)" class="week-day__today-badge">{{ t('plans.manager.weekToday') }}</span>
            </header>
            <div v-if="day.sessions.length" class="week-day__sessions">
              <!-- 项目名逐行铺开：顿号连成一整段在窄列里太挤，课程表式一行一项更好扫读。 -->
              <span
                v-for="session in day.sessions"
                :key="session.id"
                class="week-session-card"
                :class="weekSessionClass(session)"
              >
                <span v-for="name in sessionExerciseNames(session)" :key="name" class="week-session-card__item">
                  {{ name }}
                </span>
              </span>
            </div>
            <span v-else-if="day.inPlan" class="week-day__empty">{{ t('plans.manager.calendarNoSession') }}</span>
          </div>
        </div>
      </div>

      <PlanCalendarDayDetail
        v-if="calendarSelectedDate"
        :scheduled-date="calendarSelectedDate"
        :sessions="selectedSessions"
        :selected-session="selectedSession"
        :in-plan="selectedDateInPlan"
        :can-backfill="canBackfill"
        @edit-session="emit('edit-session', $event)"
        @remove-session="emit('remove-session', $event)"
        @backfill="emit('backfill', $event)"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, toRef } from 'vue';
import { ArrowLeft, ArrowRight, QuestionFilled } from '@element-plus/icons-vue';
import PlanCalendarDayDetail from '@/pages/plans/components/PlanCalendarDayDetail.vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import { todayKey, usePlanCalendar } from '@/pages/plans/composables/usePlanCalendar.js';
import { usePlanLabels } from '@/pages/plans/composables/usePlanLabels.js';
import { usePlanCoverage, usePlanProgress } from '@/pages/plans/composables/usePlanProgress.js';

const props = defineProps({
  plan: { type: Object, default: null },
  /** 初始视图：月 / 周。默认月视图，冒烟渲染用它指定周视图。 */
  initialView: {
    type: String,
    default: 'month',
    validator: (value) => ['month', 'week'].includes(value)
  },
  /** 周视图初始是否只显示工作日；冒烟渲染用它验证五列布局。 */
  initialWeekdaysOnly: { type: Boolean, default: false }
});
const emit = defineEmits(['edit-session', 'remove-session', 'backfill']);

const { t } = useLocaleStore();
const { weekdayOptions } = usePlanLabels();
const { adherenceRateText } = usePlanProgress();
const planRef = toRef(props, 'plan');
const { coverage, hasVerifiableItems, coverageRateText, verifiableCompletionRateText } = usePlanCoverage(planRef);
const {
  adherenceSummaryTooltip,
  calendarView,
  weekdaysOnly,
  calendarRangeLabel,
  calendarSelectedDate,
  canBackfill,
  dayClass,
  days,
  weekDays,
  achievedDays,
  partialDays,
  plannedDays,
  selectDate,
  selectedDateInPlan,
  selectedSession,
  selectedSessions,
  sessionClass,
  weekSessionClass,
  shiftRange
} = usePlanCalendar(planRef, {
  initialView: props.initialView,
  initialWeekdaysOnly: props.initialWeekdaysOnly
});

const previousRangeLabel = computed(() =>
  calendarView.value === 'week' ? t('plans.manager.previousWeek') : t('plans.manager.previousMonth')
);
const nextRangeLabel = computed(() =>
  calendarView.value === 'week' ? t('plans.manager.nextWeek') : t('plans.manager.nextMonth')
);

function isToday(date) {
  return date === todayKey();
}

function sessionExercisesText(session) {
  const names = (session.items || []).map((item) => item.exercise?.name).filter(Boolean);
  return names.join('、') || t('plans.manager.calendarNoSession');
}

/** 周视图逐行渲染的项目名清单；没有名字时退回"无训练安排"占位。 */
function sessionExerciseNames(session) {
  const names = (session.items || []).map((item) => item.exercise?.name).filter(Boolean);
  return names.length ? names : [t('plans.manager.calendarNoSession')];
}
</script>

<style scoped lang="scss">
.plan-calendar-section {
  padding: 20px 0 4px;
}

.calendar-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.calendar-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.calendar-help-icon {
  flex: none;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: help;
}

.calendar-help-icon:hover,
.calendar-help-icon:focus-visible {
  color: var(--primary-color);
  outline: none;
}

.calendar-header h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  letter-spacing: 0;
}

.calendar-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.calendar-view-switch {
  flex: none;
}

.calendar-weekdays-toggle {
  flex: none;
}

.calendar-navigation {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  white-space: nowrap;
}

.calendar-navigation strong {
  min-width: 88px;
  text-align: center;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.calendar-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 18px;
  margin: 18px 0 12px;
  color: var(--text-secondary);
  font-size: 12px;
}

.calendar-summary__completed {
  color: var(--el-color-success);
}

.calendar-summary__partial {
  color: var(--el-color-warning);
}

/* 达成度紧挨着计划训练日，比同行的其他小字稍强，但仍属于同一行摘要。 */
.calendar-summary__adherence {
  color: var(--text-primary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.plan-coverage {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.plan-coverage__item {
  display: grid;
  min-width: 200px;
  flex: 1 1 220px;
  gap: 2px;
  padding: 10px 14px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--card-background);
}

.plan-coverage__label {
  color: var(--text-secondary);
  font-size: 12px;
}

.plan-coverage__value {
  color: var(--text-primary);
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}

.plan-coverage__hint {
  color: var(--text-secondary);
  font-size: 12px;
}

.calendar-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.85fr);
  align-items: start;
  gap: 20px;
}

.calendar-overview {
  min-width: 0;
}

.calendar-legend {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.calendar-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-info);
}

.calendar-dot--completed {
  background: var(--el-color-success);
}

.calendar-dot--partial {
  background: var(--el-color-warning);
}

.calendar-dot--missed {
  background: var(--el-color-danger);
}

.calendar-weekdays,
.training-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.calendar-weekdays {
  gap: 6px;
  margin-bottom: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}

.training-calendar-grid {
  gap: 6px;
}

.calendar-day {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 92px;
  padding: 8px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-primary);
  text-align: left;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.calendar-day[role='button']:hover {
  border-color: var(--primary-color);
  background: var(--primary-light);
  cursor: pointer;
}

.calendar-day--empty {
  border-color: transparent;
  background: transparent;
  pointer-events: none;
}

.calendar-day--outside-plan {
  background: var(--app-bg);
  color: var(--text-secondary);
  opacity: 0.72;
}

.calendar-day--today .calendar-day__number {
  color: var(--primary-color);
  font-weight: 700;
}

.calendar-day--selected {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 14%, transparent);
}

.calendar-day--completed {
  background: color-mix(in srgb, var(--el-color-success) 7%, var(--card-bg));
}

.calendar-day--partial {
  background: color-mix(in srgb, var(--el-color-warning) 10%, var(--card-bg));
}

.calendar-day--partial[role='button']:hover,
.calendar-day--partial.calendar-day--selected {
  border-color: var(--el-color-warning);
  background: color-mix(in srgb, var(--el-color-warning) 14%, var(--card-bg));
}

.calendar-day--partial.calendar-day--selected {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-warning) 18%, transparent);
}

.calendar-day--missed {
  background: color-mix(in srgb, var(--el-color-danger) 8%, var(--card-bg));
}

.calendar-day--missed[role='button']:hover,
.calendar-day--missed.calendar-day--selected {
  border-color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 12%, var(--card-bg));
}

.calendar-day--missed.calendar-day--selected {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-danger) 15%, transparent);
}

.calendar-day__number {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.calendar-day__sessions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  margin-top: 7px;
}

.calendar-session-chip {
  display: block;
  overflow: hidden;
  padding: 3px 5px;
  border-radius: 4px;
  color: var(--text-secondary);
  background: var(--primary-light);
  font-size: 11px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-session-chip--achieved {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 12%, var(--card-bg));
}

.calendar-session-chip--partial {
  color: var(--el-color-warning);
  background: color-mix(in srgb, var(--el-color-warning) 14%, var(--card-bg));
}

.calendar-session-chip--skipped,
.calendar-session-chip--missed {
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 10%, var(--card-bg));
}

.calendar-day__sessions small {
  color: var(--text-secondary);
  font-size: 11px;
}

.calendar-day__empty {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 11px;
}

/* 周课程表：七天各一列，列头自带星期与日期，训练单元整卡铺开不截断。
   选中、今天、计划内外的底色口径复用 .calendar-day--* 那组状态类。 */
.training-week-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

/* 仅工作日：收起周末两列，五列平分整行宽度。 */
.training-week-grid--weekdays-only {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.week-day {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 180px;
  padding: 8px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-primary);
  text-align: left;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.week-day[role='button']:hover {
  border-color: var(--primary-color);
  background: var(--primary-light);
  cursor: pointer;
}

.week-day__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--card-border);
}

.week-day__weekday {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.week-day__date {
  margin-left: auto;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.week-day__today-badge {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--primary-color);
  color: #fff;
  font-size: 10px;
  line-height: 1.5;
}

.week-day__sessions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin-top: 8px;
}

.week-session-card {
  display: block;
  padding: 6px 8px;
  border-radius: 6px;
  color: var(--text-secondary);
  background: var(--primary-light);
  font-size: 12px;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
}

.week-session-card--achieved {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 12%, var(--card-bg));
}

.week-session-card--partial {
  color: var(--el-color-warning);
  background: color-mix(in srgb, var(--el-color-warning) 14%, var(--card-bg));
}

.week-session-card--skipped,
.week-session-card--missed {
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 10%, var(--card-bg));
}

/* 项目名一行一个：行距只给一点，行多了卡片自然变高，列宽不受影响。 */
.week-session-card__item {
  display: block;
}

.week-session-card__item + .week-session-card__item {
  margin-top: 5px;
}

.week-day__empty {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 11px;
}

@media (max-width: 900px) {
  .calendar-workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .calendar-header {
    flex-direction: column;
  }

  .calendar-navigation {
    width: 100%;
    justify-content: space-between;
  }

  .calendar-day {
    min-height: 68px;
    padding: 5px;
  }

  .calendar-day__empty {
    display: none;
  }

  .calendar-session-chip {
    padding: 2px 3px;
    font-size: 10px;
  }

  .week-day {
    min-height: 140px;
    padding: 5px;
  }

  .week-day__date {
    font-size: 12px;
  }

  .week-session-card {
    padding: 4px 5px;
    font-size: 11px;
  }
}
</style>

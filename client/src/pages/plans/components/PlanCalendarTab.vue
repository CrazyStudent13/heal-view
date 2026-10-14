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
      <div class="calendar-navigation">
        <el-tooltip :content="t('plans.manager.previousMonth')" placement="top">
          <el-button circle :icon="ArrowLeft" :aria-label="t('plans.manager.previousMonth')" @click="shiftMonth(-1)" />
        </el-tooltip>
        <strong>{{ calendarMonthLabel }}</strong>
        <el-tooltip :content="t('plans.manager.nextMonth')" placement="top">
          <el-button circle :icon="ArrowRight" :aria-label="t('plans.manager.nextMonth')" @click="shiftMonth(1)" />
        </el-tooltip>
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
              <span v-else-if="day.inPlan" class="calendar-day__empty">{{ t('plans.manager.calendarNoSession') }}</span>
            </template>
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
import { toRef } from 'vue';
import { ArrowLeft, ArrowRight, QuestionFilled } from '@element-plus/icons-vue';
import PlanCalendarDayDetail from '@/pages/plans/components/PlanCalendarDayDetail.vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import { usePlanCalendar } from '@/pages/plans/composables/usePlanCalendar.js';
import { usePlanLabels } from '@/pages/plans/composables/usePlanLabels.js';
import { usePlanCoverage, usePlanProgress } from '@/pages/plans/composables/usePlanProgress.js';

const props = defineProps({
  plan: { type: Object, default: null }
});
const emit = defineEmits(['edit-session', 'remove-session', 'backfill']);

const { t } = useLocaleStore();
const { weekdayOptions } = usePlanLabels();
const { adherenceRateText } = usePlanProgress();
const planRef = toRef(props, 'plan');
const { coverage, hasVerifiableItems, coverageRateText, verifiableCompletionRateText } = usePlanCoverage(planRef);
const {
  adherenceSummaryTooltip,
  calendarMonthLabel,
  calendarSelectedDate,
  canBackfill,
  dayClass,
  days,
  achievedDays,
  partialDays,
  plannedDays,
  selectDate,
  selectedDateInPlan,
  selectedSession,
  selectedSessions,
  sessionClass,
  shiftMonth
} = usePlanCalendar(planRef);

function sessionExercisesText(session) {
  const names = (session.items || []).map((item) => item.exercise?.name).filter(Boolean);
  return names.join('、') || t('plans.manager.calendarNoSession');
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
}
</style>

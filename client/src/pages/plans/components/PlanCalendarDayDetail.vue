<template>
  <div v-if="scheduledDate" class="calendar-day-detail-stack">
    <section class="calendar-day-detail">
      <header class="calendar-day-detail__header">
        <div>
          <div class="calendar-day-detail__title">
            <h5>{{ scheduledDate }}</h5>
            <el-tag
              v-if="selectedSession && calendarSessionStatus(selectedSession) !== 'planned'"
              size="small"
              :type="statusTagType(calendarSessionStatus(selectedSession))"
            >
              {{ statusLabel(calendarSessionStatus(selectedSession)) }}
            </el-tag>
          </div>
          <p v-if="sessions.length === 0">{{ t('plans.manager.calendarNoSession') }}</p>
        </div>
        <div class="calendar-day-detail__actions">
          <el-tooltip
            :content="selectedSession ? t('plans.manager.editSession') : t('plans.manager.addSession')"
            placement="top"
          >
            <el-button
              circle
              class="calendar-action-button"
              type="primary"
              :icon="selectedSession ? EditPen : Plus"
              :disabled="!inPlan"
              :aria-label="selectedSession ? t('plans.manager.editSession') : t('plans.manager.addSession')"
              @click="emit('edit-session', { session: selectedSession, scheduledDate })"
            />
          </el-tooltip>
          <el-popconfirm
            v-if="selectedSession"
            :title="t('plans.manager.confirmDeleteSession', { date: selectedSession.scheduledDate })"
            :width="250"
            confirm-button-type="danger"
            :confirm-button-text="t('common.delete')"
            :cancel-button-text="t('common.cancel')"
            @confirm="emit('remove-session', selectedSession)"
          >
            <template #reference>
              <el-button
                circle
                class="calendar-action-button"
                type="danger"
                plain
                :icon="Delete"
                :aria-label="t('common.delete')"
              />
            </template>
          </el-popconfirm>
        </div>
      </header>
      <!-- 补卡入口：达成度是打卡口径，缺证据的那天必须让用户能自己声明一次。
                           只对已过期、且没有履约的日子出现，未到的日子补卡没有意义。 -->
      <div v-if="canBackfill" class="calendar-backfill">
        <span class="calendar-backfill__hint">{{ t('plans.manager.backfillHint') }}</span>
        <el-button type="primary" plain size="small" :icon="Calendar" @click="emit('backfill', scheduledDate)">
          {{ t('plans.manager.backfill') }}
        </el-button>
      </div>
      <div v-if="sessions.length" class="calendar-session-list">
        <article v-for="session in sessions" :key="session.id" class="calendar-session-detail">
          <div class="calendar-session-detail__body">
            <div class="session-items">
              <div v-for="item in session.items" :key="item.id" class="session-item">
                <div class="session-item__heading">
                  <span>{{ item.exercise.name }}</span>
                  <el-tag v-if="item.execution" size="small" :type="itemExecutionTagType(item)">
                    {{ itemExecutionLabel(item) }}
                  </el-tag>
                  <el-tooltip
                    v-else-if="item.match"
                    :content="matchTooltip(item.match)"
                    placement="top"
                    :disabled="!matchTooltip(item.match)"
                  >
                    <el-tag size="small" :type="matchTagType(item.match)">
                      {{ statusLabel(item.match.status) }}
                    </el-tag>
                  </el-tooltip>
                </div>
                <small>{{ targetsText(item) }}</small>
                <small v-if="actualsText(item)" class="session-item__actual">{{ actualsText(item) }}</small>
                <small v-else-if="item.match" class="session-item__match">{{ matchSummary(item.match) }}</small>
                <small v-if="item.match?.ambiguous" class="session-item__match-hint">{{
                  t('plans.manager.matchAmbiguous', { count: item.match.candidateCount })
                }}</small>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
    <div v-if="selectedSession?.notes" class="calendar-session-notes">
      <span>{{ t('plans.manager.sessionNotes') }}</span>
      <p class="session-notes">{{ selectedSession.notes }}</p>
    </div>
  </div>
</template>

<script setup>
import { Calendar, Delete, EditPen, Plus } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import { calendarSessionStatus } from '@/pages/plans/composables/usePlanCalendar.js';
import { usePlanLabels } from '@/pages/plans/composables/usePlanLabels.js';
import { usePlanProgress } from '@/pages/plans/composables/usePlanProgress.js';
import { useTrainingItemEditor } from '@/pages/plans/composables/useTrainingItemEditor.js';

defineProps({
  /** 选中日期：决定标题和「这天有没有训练单元」。 */
  scheduledDate: { type: String, default: '' },
  sessions: { type: Array, default: () => [] },
  selectedSession: { type: Object, default: null },
  inPlan: { type: Boolean, default: false },
  canBackfill: { type: Boolean, default: false }
});
const emit = defineEmits(['edit-session', 'remove-session', 'backfill']);

const { t } = useLocaleStore();
const { statusLabel, statusTagType } = usePlanLabels();
const { formatRate } = usePlanProgress();
const { formatDurationText, metricValuesText, targetsText, unitLabel } = useTrainingItemEditor();

function actualsText(item) {
  const execution = item.execution;
  if (!execution) return '';
  if (execution.status === 'skipped') return t('plans.manager.itemStatuses.skipped');
  const parts = metricValuesText(execution.actuals || {});
  return parts.length > 0
    ? `${t('plans.manager.actuals')} ${parts.join(t('common.listSeparator'))}`
    : t('plans.manager.itemStatuses.done');
}

function itemExecutionLabel(item) {
  const execution = item.execution;
  if (!execution) return '';
  if (execution.status === 'skipped') return t('plans.manager.itemStatuses.skipped');
  const targetSets = Number(item.targets?.sets);
  const actualSets = Number(execution.actuals?.sets);
  if (
    Number.isFinite(targetSets) &&
    targetSets > 0 &&
    Number.isFinite(actualSets) &&
    actualSets > 0 &&
    actualSets < targetSets
  ) {
    return t('plans.manager.itemStatuses.partial');
  }
  return t('plans.manager.itemStatuses.done');
}

function itemExecutionTagType(item) {
  const execution = item.execution;
  if (!execution) return 'info';
  if (execution.status === 'skipped') return 'danger';
  return itemExecutionLabel(item) === t('plans.manager.itemStatuses.partial') ? 'warning' : 'success';
}

// —— 有氧自动匹配的展示 ——
function matchTagType(match) {
  if (!match) return 'info';
  if (match.status === 'achieved') return 'success';
  if (match.status === 'partial') return 'warning';
  return 'info';
}

/** 自动匹配到的那条导入记录摘要，单位和计划里的目标保持一致。 */
function matchRecordText(match) {
  const record = match?.record;
  if (!record) return '';
  const parts = [];
  if (record.durationSeconds) {
    parts.push(t('plans.manager.matchedRecordDuration', { duration: formatDurationText(record.durationSeconds) }));
  }
  if (record.distanceMeters) {
    const distance = (record.distanceMeters / 1000).toFixed(2);
    parts.push(t('plans.manager.matchedRecordDistance', { distance: `${distance} ${unitLabel('distance')}` }));
  }
  if (record.calories) {
    parts.push(
      t('plans.manager.matchedRecordCalories', { calories: `${Math.round(record.calories)} ${unitLabel('calories')}` })
    );
  }
  return parts.join(t('plans.manager.matchDetailSeparator'));
}

function matchReasonText(match) {
  if (!match) return '';
  if (match.reason === 'no_record') return t('plans.manager.noMatchedRecord');
  if (match.reason === 'no_sport_types') return t('plans.manager.matchReasonNoSportTypes');
  if (match.reason === 'no_target') return t('plans.manager.matchReasonNoTarget');
  if (match.reason === 'record_missing_metrics') return t('plans.manager.matchReasonRecordMissingMetrics');
  return '';
}

/** 训练项目下方的一行说明：优先显示匹配到的记录，没有记录时说明原因。 */
function matchSummary(match) {
  if (!match) return '';
  const recordText = matchRecordText(match);
  if (recordText) {
    const progress = formatRate(match.progress);
    return `${t('plans.manager.matchedRecord')}：${recordText}（${t('plans.manager.matchProgress', {
      percent: progress
    })}）`;
  }
  return matchReasonText(match);
}

function matchTooltip(match) {
  const parts = [matchReasonText(match), matchRecordText(match)].filter(Boolean);
  return parts.join(t('plans.manager.matchDetailSeparator'));
}
</script>

<style scoped lang="scss">
p {
  margin: 0;
}

.calendar-day-detail-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.calendar-day-detail {
  position: sticky;
  top: 0;
  min-width: 0;
  min-height: 226px;
  margin-top: 0;
  padding: 14px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.calendar-day-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.calendar-day-detail__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.calendar-day-detail h5 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  letter-spacing: 0;
}

.calendar-day-detail p {
  margin: 5px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.calendar-day-detail__actions {
  display: flex;
  flex: none;
  gap: 8px;
}

.calendar-action-button {
  width: 28px;
  height: 28px;
  padding: 6px;
}

.calendar-action-button :deep(.el-icon) {
  font-size: 14px;
}

.calendar-backfill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 10px 0;
  padding: 8px 12px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--card-bg);
  /* 用内阴影做一层主题无关的暖色底：浅色和深色主题下都不会突兀。 */
  box-shadow: inset 0 0 0 999px rgba(230, 162, 60, 0.08);
}

.calendar-backfill__hint {
  color: var(--text-secondary);
  font-size: 12px;
}

.calendar-session-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.calendar-session-detail {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid var(--card-border);
}

.calendar-session-detail__body {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.calendar-session-detail__body .session-items {
  flex: 1;
}

.calendar-session-notes {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.calendar-session-notes > span {
  display: block;
  margin-bottom: 6px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.calendar-session-notes .session-notes {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.session-items {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.session-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 3px;
  color: var(--text-primary);
  font-size: 13px;
}

.session-item__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.session-item__heading > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item small,
.session-notes {
  color: var(--text-secondary);
}

.session-item__actual {
  color: var(--el-color-success);
}

.session-item__match {
  color: var(--text-secondary);
}

.session-item__match-hint {
  color: var(--el-color-warning);
}

.session-notes {
  margin-top: 9px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

@media (max-width: 900px) {
  .calendar-day-detail {
    position: static;
    margin-top: 18px;
  }
}

@media (max-width: 640px) {
  .calendar-day-detail__header,
  .calendar-session-detail {
    flex-direction: column;
  }
}
</style>

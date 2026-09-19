<template>
  <section v-loading="loading" class="plan-manager">
    <header class="plan-content-header">
      <div>
        <h2>{{ t('plans.overview') }}</h2>
        <p>{{ t('plans.overviewDescription') }}</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openPlanDialog()">{{ t('plans.manager.addPlan') }}</el-button>
    </header>

    <el-alert v-if="error" class="plan-alert" type="error" :title="error" show-icon :closable="false" />

    <div class="plan-table-region" :aria-label="t('plans.title')">
      <el-table
        :data="plans"
        height="100%"
        class="plan-table"
        :row-class-name="({ row }) => (row.id === selectedPlanId ? 'is-selected' : '')"
        @row-click="(row) => selectPlan(row.id)"
      >
        <el-table-column :label="t('plans.manager.planName')" min-width="180">
          <template #default="{ row }">
            <div class="plan-cell-name" :class="planProgressClass(row)">
              {{ row.name }}-{{ row.phaseName || t('plans.manager.noPhase') }}（{{
                row.completedTrainingDayCount || 0
              }}/{{ row.trainingDayCount || 0 }}）
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.manager.planGoal')" min-width="240">
          <template #default="{ row }">
            <span class="plan-cell-goal">{{ row.goal || t('common.empty') }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.manager.planPeriod')" width="208">
          <template #default="{ row }">
            <span class="plan-period">{{ row.startDate }} - {{ row.endDate }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.manager.status')" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.sessions.title')" width="104" align="center" prop="sessionCount" />
        <el-table-column :label="t('plans.sessions.actions')" width="152" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="selectPlan(row.id)">{{
              t('plans.sessions.viewPlan')
            }}</el-button>
            <el-popconfirm
              :title="t('plans.manager.confirmDeletePlan', { name: row.name })"
              :width="360"
              confirm-button-type="danger"
              :confirm-button-text="t('common.delete')"
              :cancel-button-text="t('common.cancel')"
              @confirm="removePlan(row)"
            >
              <template #reference>
                <el-button link type="danger" @click.stop>{{ t('common.delete') }}</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('plans.overviewEmpty')" :image-size="76" />
        </template>
      </el-table>
    </div>

    <el-drawer
      v-model="detailDrawerVisible"
      class="plan-detail-drawer"
      size="min(1280px, 96vw)"
      :with-header="false"
      destroy-on-close
    >
      <main v-loading="detailLoading" class="plan-detail">
        <template v-if="planDetail">
          <header class="plan-detail-header">
            <div class="plan-detail-title">
              <div class="plan-detail-title__line">
                <h3>{{ planDetail.name }}</h3>
                <el-tag :type="statusTagType(planDetail.status)">{{ statusLabel(planDetail.status) }}</el-tag>
              </div>
              <p v-if="!planDetail.goal">{{ planDetail.startDate }} - {{ planDetail.endDate }}</p>
              <p v-if="planDetail.phases?.[0]?.name" class="plan-phase-label">
                {{ t('plans.manager.phaseName') }}：{{ planDetail.phases[0].name }}
              </p>
            </div>
            <div class="plan-detail-actions">
              <el-button :icon="EditPen" @click="openPlanDialog(planDetail)">{{ t('common.edit') }}</el-button>
              <el-button type="primary" :icon="Plus" @click="openSessionDialog()">{{
                t('plans.manager.addSession')
              }}</el-button>
              <el-popconfirm
                :title="t('plans.manager.confirmDeletePlan', { name: planDetail.name })"
                :width="360"
                confirm-button-type="danger"
                :confirm-button-text="t('common.delete')"
                :cancel-button-text="t('common.cancel')"
                @confirm="removePlan(planDetail)"
              >
                <template #reference>
                  <el-button type="danger" plain :icon="Delete">{{ t('common.delete') }}</el-button>
                </template>
              </el-popconfirm>
            </div>
            <div v-if="planDetail.goal" class="plan-goal">
              <div class="plan-goal__content">
                <div class="plan-goal__heading">
                  <span>{{ t('plans.manager.planGoal') }}</span>
                  <span class="plan-goal__period">{{ planDetail.startDate }} - {{ planDetail.endDate }}</span>
                </div>
                <p>{{ planDetail.goal }}</p>
              </div>
            </div>
          </header>

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
                  <el-button
                    circle
                    :icon="ArrowLeft"
                    :aria-label="t('plans.manager.previousMonth')"
                    @click="shiftCalendarMonth(-1)"
                  />
                </el-tooltip>
                <strong>{{ calendarMonthLabel }}</strong>
                <el-tooltip :content="t('plans.manager.nextMonth')" placement="top">
                  <el-button
                    circle
                    :icon="ArrowRight"
                    :aria-label="t('plans.manager.nextMonth')"
                    @click="shiftCalendarMonth(1)"
                  />
                </el-tooltip>
              </div>
            </header>

            <div class="calendar-summary">
              <span>{{ t('plans.manager.calendarPlanDays') }}：{{ plannedCalendarDays }}</span>
              <span class="calendar-summary__completed"
                >{{ t('plans.manager.calendarCompletedDays') }}：{{ completedCalendarDays }}</span
              >
              <span class="calendar-legend"
                ><i class="calendar-dot calendar-dot--planned"></i>{{ t('plans.manager.statuses.planned') }}</span
              >
              <span class="calendar-legend"
                ><i class="calendar-dot calendar-dot--completed"></i>{{ t('plans.manager.statuses.achieved') }}</span
              >
            </div>

            <div class="calendar-workspace">
              <div class="calendar-overview">
                <div class="calendar-weekdays" aria-hidden="true">
                  <span v-for="day in weekdayOptions" :key="day.value">{{ day.label }}</span>
                </div>
                <div class="training-calendar-grid">
                  <div
                    v-for="day in calendarDays"
                    :key="day.key"
                    class="calendar-day"
                    :class="calendarDayClass(day)"
                    role="button"
                    tabindex="0"
                    @click="day.date && selectCalendarDate(day.date)"
                    @keydown.enter="day.date && selectCalendarDate(day.date)"
                  >
                    <template v-if="day.date">
                      <time class="calendar-day__number" :datetime="day.date">{{ day.day }}</time>
                      <div v-if="day.sessions.length" class="calendar-day__sessions">
                        <span
                          v-for="session in day.sessions.slice(0, 2)"
                          :key="session.id"
                          class="calendar-session-chip"
                          :class="calendarSessionClass(session)"
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
              </div>

              <div v-if="calendarSelectedDate" class="calendar-day-detail-stack">
                <section class="calendar-day-detail">
                  <header class="calendar-day-detail__header">
                    <div>
                      <div class="calendar-day-detail__title">
                        <h5>{{ calendarSelectedDate }}</h5>
                        <el-tag
                          v-if="selectedCalendarSession"
                          size="small"
                          :type="statusTagType(selectedCalendarSession.status)"
                        >
                          {{ statusLabel(selectedCalendarSession.status) }}
                        </el-tag>
                      </div>
                      <p v-if="selectedCalendarSessions.length === 0">{{ t('plans.manager.calendarNoSession') }}</p>
                    </div>
                    <div class="calendar-day-detail__actions">
                      <el-tooltip
                        :content="
                          selectedCalendarSession ? t('plans.manager.editSession') : t('plans.manager.addSession')
                        "
                        placement="top"
                      >
                        <el-button
                          circle
                          class="calendar-action-button"
                          type="primary"
                          :icon="selectedCalendarSession ? EditPen : Plus"
                          :disabled="!selectedCalendarDateInPlan"
                          :aria-label="
                            selectedCalendarSession ? t('plans.manager.editSession') : t('plans.manager.addSession')
                          "
                          @click="openSessionDialog(selectedCalendarSession, calendarSelectedDate)"
                        />
                      </el-tooltip>
                      <el-popconfirm
                        v-if="selectedCalendarSession"
                        :title="
                          t('plans.manager.confirmDeleteSession', { date: selectedCalendarSession.scheduledDate })
                        "
                        :width="250"
                        confirm-button-type="danger"
                        :confirm-button-text="t('common.delete')"
                        :cancel-button-text="t('common.cancel')"
                        @confirm="removeSession(selectedCalendarSession)"
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
                  <div v-if="selectedCalendarSessions.length" class="calendar-session-list">
                    <article
                      v-for="session in selectedCalendarSessions"
                      :key="session.id"
                      class="calendar-session-detail"
                    >
                      <div class="calendar-session-detail__body">
                        <div class="session-items">
                          <div v-for="item in session.items" :key="item.id" class="session-item">
                            <span>{{ item.exercise.name }}</span>
                            <small>{{ targetsText(item) }}</small>
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>
                </section>
                <div v-if="selectedCalendarSession?.notes" class="calendar-session-notes">
                  <span>{{ t('plans.manager.sessionNotes') }}</span>
                  <p class="session-notes">{{ selectedCalendarSession.notes }}</p>
                </div>
              </div>
            </div>
          </section>
        </template>
      </main>
    </el-drawer>

    <el-dialog
      v-model="planDialogVisible"
      :title="editingPlanId ? t('plans.manager.editPlan') : t('plans.manager.addPlan')"
      width="min(960px, calc(100vw - 32px))"
      class="plan-dialog"
      destroy-on-close
    >
      <el-steps
        v-if="!editingPlanId"
        :active="planCreationStep"
        finish-status="success"
        simple
        class="plan-creation-steps"
      >
        <el-step :title="t('plans.manager.creationPlanInfo')" />
        <el-step :title="t('plans.manager.creationSessions')" />
      </el-steps>

      <el-form v-if="editingPlanId || planCreationStep === 0" class="plan-form" label-position="top" @submit.prevent>
        <el-form-item :label="t('plans.manager.planName')" required>
          <el-input
            v-model="planForm.name"
            maxlength="100"
            show-word-limit
            :placeholder="t('plans.manager.planNamePlaceholder')"
          />
        </el-form-item>
        <div class="plan-form-grid">
          <el-form-item :label="t('plans.manager.phaseName')">
            <el-input
              v-model="planForm.phaseName"
              maxlength="100"
              show-word-limit
              :placeholder="t('plans.manager.phaseNamePlaceholder')"
            />
          </el-form-item>
          <el-form-item :label="t('plans.manager.dateRange')" required>
            <el-date-picker v-model="planForm.dates" class="full-width" type="daterange" value-format="YYYY-MM-DD" />
          </el-form-item>
          <el-form-item :label="t('plans.manager.status')">
            <el-select v-model="planForm.status" class="full-width">
              <el-option v-for="status in planStatuses" :key="status" :label="statusLabel(status)" :value="status" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item :label="t('plans.manager.planGoal')">
          <el-input
            v-model="planForm.goal"
            type="textarea"
            :rows="2"
            maxlength="1000"
            show-word-limit
            :placeholder="t('plans.manager.planGoalPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('plans.manager.planNotes')">
          <el-input v-model="planForm.notes" type="textarea" :rows="2" maxlength="2000" show-word-limit />
        </el-form-item>
      </el-form>

      <section v-else class="plan-draft-sessions">
        <section class="batch-rule">
          <header class="batch-rule__header">
            <div>
              <h3>{{ t('plans.manager.batchTitle') }}</h3>
              <p>{{ t('plans.manager.batchDescription') }}</p>
            </div>
            <el-tag type="info" effect="plain">{{ t('plans.manager.batchHint') }}</el-tag>
          </header>

          <div class="batch-rule__controls">
            <el-form-item :label="t('plans.manager.batchFrequency')">
              <el-select v-model="batchRule.frequency" class="full-width">
                <el-option
                  v-for="frequency in batchFrequencies"
                  :key="frequency"
                  :label="t(`plans.manager.batchFrequencies.${frequency}`)"
                  :value="frequency"
                />
              </el-select>
            </el-form-item>
            <el-form-item v-if="batchRule.frequency === 'weekdays'" :label="t('plans.manager.batchWeekdays')">
              <el-checkbox-group v-model="batchRule.weekdays" class="weekday-options">
                <el-checkbox v-for="day in weekdayOptions" :key="day.value" :label="day.value">
                  {{ day.label }}
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
          </div>
          <p v-if="batchRule.frequency === 'china_workdays' && chinaCalendarLoading" class="calendar-notice">
            {{ t('plans.manager.chinaCalendarLoading') }}
          </p>
          <p
            v-else-if="batchRule.frequency === 'china_workdays' && chinaCalendarUnavailableYears.length"
            class="calendar-notice calendar-notice--warning"
          >
            {{
              t('plans.manager.chinaCalendarUnavailable', {
                years: chinaCalendarUnavailableYears.join(t('common.listSeparator'))
              })
            }}
          </p>

          <div class="training-items-heading batch-rule__items-heading">
            <span>{{ t('plans.manager.trainingItems') }}</span>
            <el-button :icon="Plus" :disabled="!canAddBatchExercise" @click="addBatchItem">
              {{ t('plans.manager.addTrainingItem') }}
            </el-button>
          </div>
          <div class="training-item-list batch-rule__items">
            <div v-for="(item, index) in batchItems" :key="item.key" class="training-item-editor">
              <div class="training-item-editor__row">
                <el-select
                  v-model="item.exerciseId"
                  class="exercise-select"
                  filterable
                  :placeholder="t('plans.manager.selectExercise')"
                  @change="resetItemTargets(item)"
                >
                  <el-option
                    v-for="exercise in batchExerciseOptionsFor(item)"
                    :key="exercise.id"
                    :label="exercise.name"
                    :value="exercise.id"
                  />
                </el-select>
                <div v-if="metricsFor(item).length > 0" class="target-grid">
                  <label v-for="metric in metricsFor(item)" :key="metric" class="target-field">
                    <span>{{ metricLabel(metric) }}</span>
                    <el-input-number
                      v-model="item.targets[metric]"
                      :min="0"
                      :precision="metricPrecision(metric)"
                      controls-position="right"
                    />
                    <small>{{ unitLabel(metric) }}</small>
                  </label>
                </div>
                <p v-else class="no-targets">{{ t('plans.manager.noTargets') }}</p>
                <el-tooltip :content="t('common.delete')" placement="top">
                  <el-button
                    circle
                    type="danger"
                    plain
                    :icon="Delete"
                    :aria-label="t('common.delete')"
                    @click="removeBatchItem(index)"
                  />
                </el-tooltip>
              </div>
            </div>
          </div>

          <el-button
            type="primary"
            :icon="MagicStick"
            :disabled="batchItems.length === 0 || (batchRule.frequency === 'china_workdays' && chinaCalendarLoading)"
            @click="generateBatchSessions"
          >
            {{ t('plans.manager.generateSessions') }}
          </el-button>
        </section>

        <header class="plan-draft-sessions__header">
          <div>
            <h3>{{ t('plans.sessions.title') }}</h3>
            <p class="draft-count">{{ t('plans.manager.draftSessionsCount', { count: draftSessions.length }) }}</p>
          </div>
          <el-button :icon="Plus" @click="openSessionDialog()">{{ t('plans.manager.addSession') }}</el-button>
        </header>

        <el-empty
          v-if="draftSessions.length === 0"
          :description="t('plans.manager.draftSessionsEmpty')"
          :image-size="76"
        />

        <div v-else class="session-list plan-draft-sessions__list">
          <article v-for="session in draftSessionsSorted" :key="session.key" class="session-row">
            <div class="session-date-block">
              <time class="session-date" :datetime="session.scheduledDate">{{ session.scheduledDate }}</time>
              <span class="session-sequence">#1</span>
            </div>
            <div class="session-main">
              <div class="session-status-line">
                <el-tag size="small" :type="statusTagType(session.status)">{{ statusLabel(session.status) }}</el-tag>
              </div>
              <div class="session-items">
                <div v-for="item in session.items" :key="item.key" class="session-item">
                  <span>{{ exerciseFor(item.exerciseId)?.name }}</span>
                  <small>{{ targetsText(item) }}</small>
                </div>
              </div>
              <p v-if="session.notes" class="session-notes">{{ session.notes }}</p>
            </div>
            <div class="session-actions">
              <el-tooltip :content="t('plans.manager.editSession')" placement="top">
                <el-button
                  circle
                  :icon="EditPen"
                  :aria-label="t('plans.manager.editSession')"
                  @click="openSessionDialog(session)"
                />
              </el-tooltip>
              <el-popconfirm
                :title="t('plans.manager.confirmDeleteSession', { date: session.scheduledDate })"
                :width="250"
                confirm-button-type="danger"
                :confirm-button-text="t('common.delete')"
                :cancel-button-text="t('common.cancel')"
                @confirm="removeDraftSession(session.key)"
              >
                <template #reference>
                  <el-button circle type="danger" plain :icon="Delete" :aria-label="t('common.delete')" />
                </template>
              </el-popconfirm>
            </div>
          </article>
        </div>
      </section>

      <template #footer>
        <el-button @click="planDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <template v-if="editingPlanId">
          <el-button type="primary" :loading="saving" @click="savePlan">{{ t('common.save') }}</el-button>
        </template>
        <template v-else-if="planCreationStep === 0">
          <el-button :loading="saving" @click="savePlanOnly">{{ t('plans.manager.createPlanOnly') }}</el-button>
          <el-button type="primary" @click="nextPlanCreationStep">{{ t('plans.manager.nextStep') }}</el-button>
        </template>
        <template v-else>
          <el-button @click="planCreationStep = 0">{{ t('plans.manager.previousStep') }}</el-button>
          <el-button type="primary" :loading="saving" @click="savePlanWithSessions">{{
            t('plans.manager.createPlanWithSessions')
          }}</el-button>
        </template>
      </template>
    </el-dialog>

    <el-dialog
      v-model="sessionDialogVisible"
      class="session-dialog"
      :title="sessionDialogTitle"
      width="min(820px, calc(100vw - 32px))"
      top="6vh"
      destroy-on-close
    >
      <el-form label-position="top" @submit.prevent>
        <div class="session-form-grid" :class="{ 'session-form-grid--editing': isEditingSession }">
          <el-form-item v-if="!isEditingSession" :label="t('plans.manager.sessionDate')" required>
            <el-date-picker
              v-model="sessionForm.scheduledDate"
              class="full-width"
              type="date"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item :label="t('plans.manager.status')">
            <el-select v-model="sessionForm.status" class="full-width">
              <el-option v-for="status in sessionStatuses" :key="status" :label="statusLabel(status)" :value="status" />
            </el-select>
          </el-form-item>
        </div>

        <div class="training-items-heading">
          <span>{{ t('plans.manager.trainingItems') }}</span>
          <el-button :icon="Plus" :disabled="!canAddExercise" @click="addSessionItem">{{
            t('plans.manager.addTrainingItem')
          }}</el-button>
        </div>

        <div class="session-items-table-wrap">
          <el-table :data="sessionForm.items" border class="session-items-table">
            <el-table-column :label="t('plans.manager.trainingItems')" min-width="220">
              <template #default="{ row: item }">
                <el-select
                  v-model="item.exerciseId"
                  class="exercise-select"
                  filterable
                  :placeholder="t('plans.manager.selectExercise')"
                  @change="resetItemTargets(item)"
                >
                  <el-option
                    v-for="exercise in exerciseOptionsFor(item)"
                    :key="exercise.id"
                    :label="exercise.name"
                    :value="exercise.id"
                    :disabled="!exercise.enabled"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column :label="t('plans.manager.targets')" min-width="460">
              <template #default="{ row: item }">
                <div v-if="metricsFor(item).length > 0" class="target-grid session-target-grid">
                  <label v-for="metric in metricsFor(item)" :key="metric" class="target-field">
                    <span>{{ metricLabel(metric) }}</span>
                    <el-input-number
                      v-model="item.targets[metric]"
                      :min="0"
                      :precision="metricPrecision(metric)"
                      controls-position="right"
                    />
                    <small>{{ unitLabel(metric) }}</small>
                  </label>
                </div>
                <p v-else class="no-targets">{{ t('plans.manager.noTargets') }}</p>
              </template>
            </el-table-column>
            <el-table-column :label="t('plans.sessions.actions')" width="72" align="center">
              <template #default="{ $index }">
                <el-tooltip :content="t('common.delete')" placement="top">
                  <el-button
                    link
                    type="danger"
                    :icon="Delete"
                    :aria-label="t('common.delete')"
                    @click="removeSessionItem($index)"
                  />
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-form-item :label="t('plans.manager.sessionNotes')">
          <el-input v-model="sessionForm.notes" type="textarea" :rows="3" maxlength="2000" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sessionDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveSession">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, ArrowRight, Delete, EditPen, MagicStick, Plus, QuestionFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import { normalizeRequestError } from '@/utils/requestState.js';
import {
  createTrainingPhase,
  createTrainingPlan,
  createTrainingPlanWithSessions,
  createTrainingSession,
  deleteTrainingPlan,
  deleteTrainingSession,
  getTrainingExercises,
  getChinaWorkdayCalendar,
  getTrainingPlan,
  getTrainingPlans,
  updateTrainingPhase,
  updateTrainingPlan,
  updateTrainingSession
} from '@/api/fitnessApi.js';

const { t } = useLocaleStore();
const route = useRoute();
const loading = ref(false);
const detailLoading = ref(false);
const saving = ref(false);
const error = ref('');
const plans = ref([]);
const exercises = ref([]);
const selectedPlanId = ref(null);
const planDetail = ref(null);
const detailDrawerVisible = ref(false);
const planDialogVisible = ref(false);
const sessionDialogVisible = ref(false);
const editingPlanId = ref(null);
const editingSessionId = ref(null);
const editingDraftSessionKey = ref(null);
const planCreationStep = ref(0);
const draftSessions = ref([]);
const batchItems = ref([]);
const chinaCalendar = ref(new Map());
const chinaCalendarUnavailableYears = ref([]);
const chinaCalendarLoading = ref(false);
let itemKey = 0;
let draftSessionKey = 0;

const planStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];
const sessionStatuses = ['planned', 'achieved', 'partial', 'no_data', 'unverifiable', 'skipped'];
const planForm = reactive({ name: '', phaseName: '', dates: [], status: 'draft', goal: '', notes: '' });
const sessionForm = reactive({ scheduledDate: '', notes: '', status: 'planned', items: [] });
const batchRule = reactive({ frequency: 'china_workdays', weekdays: [1, 2, 3, 4, 5] });
const batchFrequencies = ['daily', 'china_workdays', 'weekdays', 'odd', 'even'];
const weekdayOptions = computed(() => [
  { value: 1, label: t('plans.manager.weekdays.mon') },
  { value: 2, label: t('plans.manager.weekdays.tue') },
  { value: 3, label: t('plans.manager.weekdays.wed') },
  { value: 4, label: t('plans.manager.weekdays.thu') },
  { value: 5, label: t('plans.manager.weekdays.fri') },
  { value: 6, label: t('plans.manager.weekdays.sat') },
  { value: 0, label: t('plans.manager.weekdays.sun') }
]);

const canAddExercise = computed(() =>
  exercises.value.some(
    (exercise) => exercise.enabled && !sessionForm.items.some((item) => item.exerciseId === exercise.id)
  )
);
const canAddBatchExercise = computed(() =>
  exercises.value.some(
    (exercise) => exercise.enabled && !batchItems.value.some((item) => item.exerciseId === exercise.id)
  )
);

const isCreatingPlan = computed(() => !editingPlanId.value && planDialogVisible.value && planCreationStep.value === 1);
const isEditingSession = computed(() => Boolean(editingSessionId.value || editingDraftSessionKey.value));
const sessionDialogTitle = computed(() =>
  isEditingSession.value
    ? t('plans.manager.editSessionWithDate', { date: sessionForm.scheduledDate })
    : t('plans.manager.addSession')
);
const calendarMonth = ref('');
const calendarSelectedDate = ref('');
const calendarMonthLabel = computed(() => calendarMonth.value.replace('-', ' / '));
const selectedCalendarSessions = computed(() =>
  (planDetail.value?.sessions || []).filter((session) => session.scheduledDate === calendarSelectedDate.value)
);
const selectedCalendarSession = computed(() => selectedCalendarSessions.value[0] || null);
const selectedCalendarDateInPlan = computed(() => {
  const plan = planDetail.value;
  return Boolean(
    plan &&
      calendarSelectedDate.value &&
      calendarSelectedDate.value >= plan.startDate &&
      calendarSelectedDate.value <= plan.endDate
  );
});
const plannedCalendarDays = computed(
  () => new Set((planDetail.value?.sessions || []).map((session) => session.scheduledDate)).size
);
const completedCalendarDays = computed(
  () =>
    new Set(
      (planDetail.value?.sessions || [])
        .filter((session) => ['achieved', 'partial'].includes(session.status))
        .map((session) => session.scheduledDate)
    ).size
);
const calendarDays = computed(() => {
  if (!calendarMonth.value) return [];
  const [year, month] = calendarMonth.value.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const leadingDays = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const sessionsByDate = new Map();
  for (const session of planDetail.value?.sessions || []) {
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
      inPlan: date >= planDetail.value.startDate && date <= planDetail.value.endDate
    };
  });
});
const draftSessionsSorted = computed(() =>
  [...draftSessions.value].sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate))
);

function statusLabel(status) {
  return t(`plans.manager.statuses.${status}`);
}

function statusTagType(status) {
  if (['active', 'achieved', 'completed'].includes(status)) return 'success';
  if (['paused', 'partial'].includes(status)) return 'warning';
  if (['cancelled', 'skipped'].includes(status)) return 'danger';
  return 'info';
}

function planProgressClass(plan) {
  const plannedDays = Number(plan.trainingDayCount || 0);
  const completedDays = Number(plan.completedTrainingDayCount || 0);
  if (plan.status === 'completed' || (plannedDays > 0 && completedDays >= plannedDays)) {
    return 'plan-cell-name--completed';
  }

  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
  if (today >= plan.startDate && today <= plan.endDate) return 'plan-cell-name--active';
  if (today > plan.endDate && completedDays < plannedDays) return 'plan-cell-name--incomplete';
  return '';
}

function metricLabel(metric) {
  return t(`plans.exercise.metricOptions.${metric}`);
}

function unitLabel(metric) {
  return t(`plans.manager.units.${metric}`);
}

function metricPrecision(metric) {
  return ['distance', 'weight', 'speed', 'incline'].includes(metric) ? 1 : 0;
}

function targetsText(item) {
  const entries = Object.entries(item.targets || {});
  if (entries.length === 0) return t('plans.manager.noTargets');
  return entries
    .map(([metric, value]) => `${metricLabel(metric)} ${value} ${unitLabel(metric)}`)
    .join(t('common.listSeparator'));
}

async function loadPlanDetail(id) {
  if (!id) {
    planDetail.value = null;
    calendarMonth.value = '';
    calendarSelectedDate.value = '';
    return;
  }
  detailLoading.value = true;
  try {
    planDetail.value = await getTrainingPlan(id);
    calendarMonth.value = planDetail.value.startDate.slice(0, 7);
    calendarSelectedDate.value = planDetail.value.sessions?.[0]?.scheduledDate || planDetail.value.startDate || '';
  } catch (requestError) {
    error.value = normalizeRequestError(requestError, t) || t('plans.manager.loadFailed');
  } finally {
    detailLoading.value = false;
  }
}

async function loadPlans(preferredId = selectedPlanId.value) {
  const response = await getTrainingPlans();
  plans.value = response.plans;
  const nextId = plans.value.some((plan) => plan.id === preferredId) ? preferredId : plans.value[0]?.id || null;
  selectedPlanId.value = nextId;
  await loadPlanDetail(nextId);
}

async function loadWorkspace() {
  loading.value = true;
  error.value = '';
  try {
    const exerciseResponse = await getTrainingExercises();
    exercises.value = exerciseResponse.exercises;
    const requestedPlanId = Number(route.query.planId);
    await loadPlans(Number.isInteger(requestedPlanId) && requestedPlanId > 0 ? requestedPlanId : null);
    detailDrawerVisible.value = Number.isInteger(requestedPlanId) && selectedPlanId.value === requestedPlanId;
  } catch (requestError) {
    error.value = normalizeRequestError(requestError, t) || t('plans.manager.loadFailed');
  } finally {
    loading.value = false;
  }
}

async function selectPlan(id) {
  if (id === selectedPlanId.value) {
    if (planDetail.value) detailDrawerVisible.value = true;
    return;
  }
  selectedPlanId.value = id;
  error.value = '';
  await loadPlanDetail(id);
  if (planDetail.value) detailDrawerVisible.value = true;
}

function openPlanDialog(plan = null) {
  editingPlanId.value = plan?.id || null;
  planCreationStep.value = 0;
  draftSessions.value = [];
  batchItems.value = [];
  Object.assign(batchRule, { frequency: 'china_workdays', weekdays: [1, 2, 3, 4, 5] });
  chinaCalendar.value = new Map();
  chinaCalendarUnavailableYears.value = [];
  editingDraftSessionKey.value = null;
  Object.assign(planForm, {
    name: plan?.name || '',
    phaseName: plan?.phases?.[0]?.name || plan?.phaseName || '',
    dates: plan ? [plan.startDate, plan.endDate] : [],
    status: plan?.status || 'draft',
    goal: plan?.goal || '',
    notes: plan?.notes || ''
  });
  planDialogVisible.value = true;
}

function shiftCalendarMonth(offset) {
  if (!calendarMonth.value) return;
  const [year, month] = calendarMonth.value.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  calendarMonth.value = next.toISOString().slice(0, 7);
}

function selectCalendarDate(date) {
  if (!date) return;
  calendarSelectedDate.value = date;
}

function calendarDayClass(day) {
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');
  const hasCompleted = day.sessions.some((session) => ['achieved', 'partial'].includes(session.status));
  return {
    'calendar-day--empty': !day.date,
    'calendar-day--outside-plan': day.date && !day.inPlan,
    'calendar-day--in-plan': day.inPlan,
    'calendar-day--today': day.date === todayKey,
    'calendar-day--selected': day.date === calendarSelectedDate.value,
    'calendar-day--completed': hasCompleted
  };
}

function calendarSessionClass(session) {
  return 'calendar-session-chip--' + (session.status || 'planned');
}

function sessionExercisesText(session) {
  const names = (session.items || []).map((item) => item.exercise?.name).filter(Boolean);
  return names.join('、') || t('plans.manager.calendarNoSession');
}

function planPayload() {
  return {
    name: planForm.name,
    startDate: planForm.dates[0],
    endDate: planForm.dates[1],
    status: planForm.status,
    goal: planForm.goal,
    notes: planForm.notes
  };
}

function validatePlanForm() {
  if (!planForm.name.trim()) {
    ElMessage.warning(t('plans.manager.nameRequired'));
    return false;
  }
  if (planForm.dates.length !== 2) {
    ElMessage.warning(t('plans.manager.datesRequired'));
    return false;
  }
  return true;
}

async function nextPlanCreationStep() {
  if (!validatePlanForm()) return;
  planCreationStep.value = 1;
  await loadChinaCalendar();
}

async function loadChinaCalendar() {
  chinaCalendarLoading.value = true;
  chinaCalendarUnavailableYears.value = [];
  try {
    const response = await getChinaWorkdayCalendar({
      startDate: planForm.dates[0],
      endDate: planForm.dates[1]
    });
    chinaCalendar.value = new Map(response.overrides.map((day) => [day.date, day]));
    chinaCalendarUnavailableYears.value = response.unavailableYears || [];
  } catch (requestError) {
    chinaCalendar.value = new Map();
    const startYear = Number(planForm.dates[0]?.slice(0, 4));
    const endYear = Number(planForm.dates[1]?.slice(0, 4));
    chinaCalendarUnavailableYears.value = Array.from(
      { length: endYear - startYear + 1 },
      (_, index) => startYear + index
    ).filter(Number.isInteger);
    ElMessage.warning(normalizeRequestError(requestError, t) || t('plans.manager.chinaCalendarLoadFailed'));
  } finally {
    chinaCalendarLoading.value = false;
  }
}

async function syncPlanPhase(planId, existingPhase = null) {
  const name = planForm.phaseName.trim();
  if (!name) return;
  const payload = {
    name,
    startDate: planForm.dates[0],
    endDate: planForm.dates[1],
    status: existingPhase?.status || 'planned',
    description: existingPhase?.description || '',
    adjustmentReason: existingPhase?.adjustmentReason || ''
  };
  if (existingPhase?.id) await updateTrainingPhase(existingPhase.id, payload);
  else await createTrainingPhase(planId, payload);
}

async function savePlan() {
  if (!validatePlanForm()) return;
  saving.value = true;
  try {
    const saved = await updateTrainingPlan(editingPlanId.value, planPayload());
    await syncPlanPhase(saved.id, planDetail.value?.phases?.[0] || null);
    planDialogVisible.value = false;
    await loadPlans(saved.id);
    detailDrawerVisible.value = true;
    ElMessage.success(t('plans.manager.saved'));
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.saveFailed'));
  } finally {
    saving.value = false;
  }
}

async function savePlanOnly() {
  if (!validatePlanForm()) return;
  saving.value = true;
  try {
    const saved = await createTrainingPlan(planPayload());
    await syncPlanPhase(saved.id);
    planDialogVisible.value = false;
    await loadPlans(saved.id);
    detailDrawerVisible.value = true;
    ElMessage.success(t('plans.manager.saved'));
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.saveFailed'));
  } finally {
    saving.value = false;
  }
}

async function savePlanWithSessions() {
  if (!validatePlanForm()) return;
  if (!validateDraftSessions()) return;
  saving.value = true;
  try {
    const saved = await createTrainingPlanWithSessions({
      plan: planPayload(),
      sessions: draftSessions.value.map((session) => ({
        scheduledDate: session.scheduledDate,
        notes: session.notes,
        status: session.status,
        items: session.items.map((item) => ({ exerciseId: item.exerciseId, targets: item.targets }))
      }))
    });
    await syncPlanPhase(saved.id);
    planDialogVisible.value = false;
    await loadPlans(saved.id);
    detailDrawerVisible.value = true;
    ElMessage.success(t('plans.manager.saved'));
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.saveFailed'));
  } finally {
    saving.value = false;
  }
}

function validateDraftSessions() {
  const dates = new Set();
  for (const session of draftSessions.value) {
    if (session.scheduledDate < planForm.dates[0] || session.scheduledDate > planForm.dates[1]) {
      ElMessage.warning(t('plans.manager.sessionOutsidePlan'));
      return false;
    }
    if (dates.has(session.scheduledDate)) {
      ElMessage.warning(t('plans.manager.sessionDateExists'));
      return false;
    }
    dates.add(session.scheduledDate);
  }
  return true;
}

async function removePlan(plan) {
  try {
    await deleteTrainingPlan(plan.id);
    detailDrawerVisible.value = false;
    selectedPlanId.value = null;
    planDetail.value = null;
    await loadPlans();
    ElMessage.success(t('plans.manager.planDeleted'));
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.deleteFailed'));
  }
}

function createItem(exerciseId = null, targets = {}) {
  itemKey += 1;
  return { key: itemKey, exerciseId, targets: { ...targets } };
}

function batchExerciseOptionsFor(currentItem) {
  const selectedIds = new Set(batchItems.value.filter((item) => item !== currentItem).map((item) => item.exerciseId));
  return exercises.value.filter(
    (exercise) => !selectedIds.has(exercise.id) && (exercise.enabled || exercise.id === currentItem.exerciseId)
  );
}

function addBatchItem() {
  const exercise = exercises.value.find(
    (candidate) => candidate.enabled && !batchItems.value.some((item) => item.exerciseId === candidate.id)
  );
  if (!exercise) return;
  const item = createItem(exercise.id);
  batchItems.value.push(item);
  resetItemTargets(item);
}

function removeBatchItem(index) {
  batchItems.value.splice(index, 1);
}

function batchDates() {
  const [startDate, endDate] = planForm.dates;
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    const dayOfMonth = cursor.getUTCDate();
    const date = cursor.toISOString().slice(0, 10);
    const calendarDay = chinaCalendar.value.get(date);
    const matches =
      batchRule.frequency === 'daily' ||
      (batchRule.frequency === 'china_workdays' && isChinaWorkday(date, calendarDay)) ||
      (batchRule.frequency === 'weekdays' && batchRule.weekdays.includes(day)) ||
      (batchRule.frequency === 'odd' && dayOfMonth % 2 === 1) ||
      (batchRule.frequency === 'even' && dayOfMonth % 2 === 0);
    if (matches) dates.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function generateBatchSessions() {
  if (batchRule.frequency === 'weekdays' && batchRule.weekdays.length === 0) {
    return ElMessage.warning(t('plans.manager.batchWeekdaysRequired'));
  }
  if (batchRule.frequency === 'china_workdays' && chinaCalendarUnavailableYears.value.length > 0) {
    return ElMessage.warning(
      t('plans.manager.chinaCalendarUnavailable', {
        years: chinaCalendarUnavailableYears.value.join(t('common.listSeparator'))
      })
    );
  }
  const dates = batchDates();
  const existingDates = new Set(draftSessions.value.map((session) => session.scheduledDate));
  const conflicts = dates.filter((date) => existingDates.has(date));
  if (conflicts.length > 0) return ElMessage.warning(t('plans.manager.batchConflict', { count: conflicts.length }));
  dates.forEach((scheduledDate) => {
    draftSessions.value.push({
      key: ++draftSessionKey,
      scheduledDate,
      notes: '',
      status: 'planned',
      items: batchItems.value.map((item) => createItem(item.exerciseId, item.targets))
    });
  });
  ElMessage.success(t('plans.manager.batchGenerated', { count: dates.length }));
}

function isChinaWorkday(date, override) {
  if (override?.type === 'transfer_workday') return true;
  if (override?.type === 'public_holiday') return false;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

function openSessionDialog(session = null, scheduledDate = '') {
  editingSessionId.value = isCreatingPlan.value ? null : session?.id || null;
  editingDraftSessionKey.value = isCreatingPlan.value ? session?.key || null : null;
  Object.assign(sessionForm, {
    scheduledDate:
      scheduledDate ||
      session?.scheduledDate ||
      (isCreatingPlan.value ? planForm.dates[0] : planDetail.value.startDate),
    notes: session?.notes || '',
    status: session?.status || 'planned',
    items: session?.items?.map((item) => createItem(item.exerciseId, item.targets)) || []
  });
  if (sessionForm.items.length === 0) addSessionItem();
  sessionDialogVisible.value = true;
}

function exerciseFor(id) {
  return exercises.value.find((exercise) => exercise.id === id) || null;
}

function exerciseOptionsFor(currentItem) {
  const selectedIds = new Set(sessionForm.items.filter((item) => item !== currentItem).map((item) => item.exerciseId));
  return exercises.value.filter(
    (exercise) => !selectedIds.has(exercise.id) && (exercise.enabled || exercise.id === currentItem.exerciseId)
  );
}

function metricsFor(item) {
  return exerciseFor(item.exerciseId)?.metrics || [];
}

function addSessionItem() {
  const selectedIds = new Set(sessionForm.items.map((item) => item.exerciseId));
  const exercise = exercises.value.find((candidate) => candidate.enabled && !selectedIds.has(candidate.id));
  if (!exercise) return;
  const item = createItem(exercise.id);
  sessionForm.items.push(item);
  resetItemTargets(item);
}

function removeSessionItem(index) {
  sessionForm.items.splice(index, 1);
}

function resetItemTargets(item) {
  item.targets = Object.fromEntries(metricsFor(item).map((metric) => [metric, undefined]));
}

async function saveSession() {
  if (!sessionForm.scheduledDate) return ElMessage.warning(t('plans.manager.dateRequired'));
  if (sessionForm.items.length === 0) return ElMessage.warning(t('plans.manager.itemsRequired'));
  if (sessionForm.items.some((item) => !item.exerciseId)) return ElMessage.warning(t('plans.manager.exerciseRequired'));
  const payload = {
    scheduledDate: sessionForm.scheduledDate,
    notes: sessionForm.notes,
    status: sessionForm.status,
    items: sessionForm.items.map((item) => ({
      exerciseId: item.exerciseId,
      targets: Object.fromEntries(
        Object.entries(item.targets).filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0)
      )
    }))
  };
  if (isCreatingPlan.value) {
    if (payload.scheduledDate < planForm.dates[0] || payload.scheduledDate > planForm.dates[1]) {
      return ElMessage.warning(t('plans.manager.sessionOutsidePlan'));
    }
    if (
      draftSessions.value.some(
        (session) => session.scheduledDate === payload.scheduledDate && session.key !== editingDraftSessionKey.value
      )
    ) {
      return ElMessage.warning(t('plans.manager.sessionDateExists'));
    }
    const draft = { key: editingDraftSessionKey.value || ++draftSessionKey, ...payload };
    const index = draftSessions.value.findIndex((session) => session.key === draft.key);
    if (index === -1) draftSessions.value.push(draft);
    else draftSessions.value.splice(index, 1, draft);
    sessionDialogVisible.value = false;
    return;
  }

  saving.value = true;
  try {
    if (editingSessionId.value) await updateTrainingSession(editingSessionId.value, payload);
    else await createTrainingSession(planDetail.value.id, payload);
    sessionDialogVisible.value = false;
    await loadPlans(planDetail.value.id);
    ElMessage.success(t('plans.manager.saved'));
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.saveFailed'));
  } finally {
    saving.value = false;
  }
}

function removeDraftSession(key) {
  draftSessions.value = draftSessions.value.filter((session) => session.key !== key);
}

async function removeSession(session) {
  try {
    await deleteTrainingSession(session.id);
    await loadPlans(planDetail.value.id);
    ElMessage.success(t('plans.manager.sessionDeleted'));
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.deleteFailed'));
  }
}

onMounted(loadWorkspace);
</script>

<style scoped lang="scss">
.plan-manager {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.plan-content-header,
.plan-detail-header,
.phase-header,
.phase-title-line,
.plan-detail-title__line,
.training-items-heading,
.training-item-editor__top {
  display: flex;
  align-items: center;
}
.plan-content-header {
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--card-border);
}
h2,
h3,
h4,
p {
  margin: 0;
}
h2 {
  color: var(--text-primary);
  font-size: 22px;
  letter-spacing: 0;
}
.plan-content-header p,
.plan-detail-title > p,
.phase-header p {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}
.plan-alert {
  margin-top: 16px;
}
.plan-dialog :deep(.el-dialog__body) {
  max-height: calc(100vh - 180px);
  padding: 12px 20px 16px;
  overflow-y: auto;
}
.plan-dialog :deep(.el-dialog__header) {
  padding: 16px 20px 8px;
}
.plan-dialog :deep(.el-dialog__title) {
  color: var(--text-primary);
  font-size: 16px;
  line-height: 24px;
}
.plan-dialog :deep(.el-dialog__footer) {
  padding: 10px 20px 16px;
}
.plan-creation-steps {
  margin: 0 0 16px;
}
.plan-form :deep(.el-form-item) {
  margin-bottom: 14px;
}
.plan-form-grid {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(280px, 1.25fr) 160px;
  align-items: start;
  gap: 12px;
}
.plan-form-grid :deep(.el-form-item) {
  width: auto;
  min-width: 0;
}
.plan-draft-sessions {
  min-height: 280px;
}
.plan-draft-sessions__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.plan-draft-sessions__header h3 {
  color: var(--text-primary);
  font-size: 16px;
  letter-spacing: 0;
}
.draft-count,
.batch-rule__header p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.batch-rule {
  margin-bottom: 22px;
  padding: 14px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--app-bg);
}
.batch-rule__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.batch-rule__header h3 {
  color: var(--text-primary);
  font-size: 15px;
  letter-spacing: 0;
}
.batch-rule__controls {
  display: grid;
  grid-template-columns: minmax(180px, 0.7fr) minmax(300px, 1.3fr);
  gap: 16px;
}
.weekday-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.calendar-notice {
  margin: -4px 0 12px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.calendar-notice--warning {
  color: var(--el-color-warning);
}
.batch-rule__items-heading {
  margin-top: 2px;
}
.batch-rule__items {
  margin-bottom: 14px;
}
.plan-draft-sessions__list {
  margin-bottom: 20px;
}
.phase-empty {
  display: grid;
  min-height: 180px;
  place-items: center;
}
.plan-table-region {
  flex: 1;
  min-height: 380px;
  margin-top: 20px;
  overflow: auto;
}
.plan-table {
  min-width: 1080px;
}
.plan-table :deep(.el-table__row) {
  cursor: pointer;
}
.plan-table :deep(.el-table__row.is-selected > td.el-table__cell) {
  background: var(--primary-light);
}
.plan-cell-name {
  color: var(--text-primary);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.plan-cell-goal {
  display: block;
  overflow: hidden;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plan-period {
  color: var(--text-secondary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.plan-calendar-section {
  padding: 20px 0 4px;
  border-top: 1px solid var(--card-border);
}
.calendar-header,
.calendar-day-detail__header {
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
.calendar-day-detail__actions {
  display: flex;
  flex: none;
  gap: 8px;
}
.calendar-day-detail__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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
.calendar-header h4,
.calendar-day-detail h5 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  letter-spacing: 0;
}
.calendar-header p,
.calendar-day-detail p {
  margin: 5px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
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
.calendar-dot--planned {
  background: var(--el-color-warning);
}
.calendar-dot--completed {
  background: var(--el-color-success);
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
.calendar-session-chip--skipped {
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
.calendar-day-detail-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
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
.plan-detail {
  min-width: 0;
  overflow: auto;
  padding: 20px;
}
.plan-detail-drawer :deep(.el-drawer__body) {
  padding: 0;
}
.plan-detail-header,
.phase-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.plan-detail-header {
  flex-wrap: wrap;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--card-border);
}
.plan-detail-title__line,
.phase-title-line {
  gap: 10px;
}
.plan-detail-title h3 {
  color: var(--text-primary);
  font-size: 20px;
  letter-spacing: 0;
}
.phase-description {
  max-width: 720px;
  line-height: 1.55;
  white-space: pre-wrap;
}
.plan-goal {
  display: flex;
  align-items: flex-start;
  flex: 0 0 100%;
  width: 100%;
  padding: 9px 12px;
  border-left: 3px solid var(--primary-color);
  border-radius: 0 4px 4px 0;
  background: color-mix(in srgb, var(--primary-color) 7%, var(--card-bg));
}
.plan-goal__content {
  width: 100%;
  min-width: 0;
}
.plan-goal__heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-bottom: 2px;
}
.plan-goal__heading > span:first-child {
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
}
.plan-goal__period {
  color: var(--text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.plan-goal__content > p {
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.55;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.plan-detail-actions,
.phase-actions,
.session-actions {
  display: flex;
  flex: none;
  gap: 8px;
}
.phase-list {
  display: flex;
  flex-direction: column;
}
.phase-section {
  padding: 20px 0;
  border-bottom: 1px solid var(--card-border);
}
.phase-section:last-child {
  border-bottom: 0;
}
.plan-sessions-section {
  padding: 20px 0;
  border-top: 1px solid var(--card-border);
}
.plan-sessions-section h4 {
  color: var(--text-primary);
  font-size: 16px;
  letter-spacing: 0;
}
.phase-header h4 {
  color: var(--text-primary);
  font-size: 16px;
  letter-spacing: 0;
}
.session-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 82px;
  margin-top: 14px;
  color: var(--text-secondary);
  font-size: 13px;
}
.session-list {
  margin-top: 16px;
  border-top: 1px solid var(--card-border);
}
.session-row {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr) auto;
  align-items: start;
  gap: 16px;
  padding: 14px 4px;
  border-bottom: 1px solid var(--card-border);
  transition: background-color 0.2s ease;
}
.session-row:hover {
  background: color-mix(in srgb, var(--primary-light) 42%, transparent);
}
.session-row:last-child {
  border-bottom: 0;
}
.session-date-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.session-date {
  color: var(--text-secondary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.session-sequence {
  color: var(--text-tertiary, var(--text-secondary));
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.session-main {
  min-width: 0;
}
.session-status-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 13px;
}
.session-items {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.session-item {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--text-primary);
  font-size: 13px;
}
.session-item small,
.session-notes,
.no-targets {
  color: var(--text-secondary);
}
.session-notes {
  margin-top: 9px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.full-width {
  width: 100%;
}
.session-dialog :deep(.el-dialog__body) {
  max-height: calc(88vh - 130px);
  overflow-y: auto;
}
.session-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.session-form-grid--editing {
  grid-template-columns: minmax(220px, 320px);
}
.training-items-heading {
  justify-content: space-between;
  margin: 6px 0 12px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}
.training-item-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 18px;
}
.session-items-table-wrap {
  margin-bottom: 18px;
  overflow-x: auto;
}
.session-items-table {
  min-width: 752px;
}
.session-items-table :deep(.el-table__cell) {
  padding: 8px 0;
}
.session-items-table :deep(th.el-table__cell) {
  color: var(--text-secondary);
  background: var(--app-bg);
  font-weight: 600;
}
.session-items-table :deep(.cell) {
  padding: 0 12px;
}
.training-item-editor {
  padding: 12px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--app-bg);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}
.training-item-editor:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 14%, transparent);
}
.training-item-editor__row {
  display: grid;
  grid-template-columns: minmax(220px, 1.25fr) minmax(0, 2.4fr) auto;
  align-items: center;
  gap: 12px;
}
.exercise-select {
  width: 100%;
}
.target-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px 12px;
  min-width: 0;
}
.session-target-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
.target-field {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}
.target-field > span,
.target-field small {
  flex: none;
}
.target-field :deep(.el-input-number) {
  width: auto;
  min-width: 72px;
  flex: 1;
}
.target-field small {
  min-width: 0;
}
.no-targets {
  margin: 0;
  font-size: 12px;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .plan-table-region {
    overflow: auto;
  }
  .calendar-workspace {
    grid-template-columns: 1fr;
  }
  .calendar-day-detail {
    position: static;
    margin-top: 18px;
  }
  .training-item-editor__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .target-grid,
  .no-targets {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .plan-form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .plan-content-header,
  .plan-detail-header,
  .phase-header,
  .plan-draft-sessions__header,
  .calendar-header,
  .calendar-day-detail__header {
    flex-direction: column;
  }
  .plan-content-header > .el-button,
  .plan-detail-actions {
    width: 100%;
  }
  .plan-detail-actions > .el-button {
    flex: 1;
  }
  .session-row {
    grid-template-columns: 1fr auto;
  }
  .session-date-block {
    grid-column: 1 / -1;
  }
  .session-form-grid,
  .target-grid,
  .batch-rule__controls,
  .plan-form-grid {
    grid-template-columns: 1fr !important;
  }
  .batch-rule__header {
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
  .calendar-session-detail {
    flex-direction: column;
  }
}
</style>

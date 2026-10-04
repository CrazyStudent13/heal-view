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
              <el-button type="primary" :icon="Plus" @click="openBatchSessionDialog()">{{
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

          <el-tabs v-model="planDetailTab" class="plan-detail-tabs">
            <el-tab-pane name="calendar">
              <template #label>
                <span class="plan-tab-label">{{ t('plans.manager.calendarTitle') }}</span>
              </template>
              <section class="plan-calendar-section">
                <header class="calendar-header">
                  <div class="calendar-title">
                    <h4>{{ t('plans.manager.calendarTitle') }}</h4>
                    <el-tooltip :content="t('plans.manager.calendarDescription')" placement="top">
                      <el-icon
                        class="calendar-help-icon"
                        :aria-label="t('plans.manager.calendarDescription')"
                        tabindex="0"
                      >
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
                    ><i class="calendar-dot calendar-dot--completed"></i
                    >{{ t('plans.manager.statuses.achieved') }}</span
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
            </el-tab-pane>
            <el-tab-pane name="review">
              <template #label>
                <span class="plan-tab-label">
                  {{ t('plans.manager.phaseReviews') }}
                  <el-tag size="small" effect="plain" :type="planReviewPhase?.review ? 'success' : 'info'">
                    {{
                      planReviewPhase?.review
                        ? t('plans.manager.reviewStatusFilled')
                        : t('plans.manager.reviewStatusPending')
                    }}
                  </el-tag>
                </span>
              </template>
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
                  <el-button type="primary" plain :icon="EditPen" @click="openPlanReviewDialog">
                    {{ planReviewPhase.review ? t('plans.manager.editReview') : t('plans.manager.addReview') }}
                  </el-button>
                </header>

                <article class="plan-review-card">
                  <div class="plan-review-card__meta">
                    <div>
                      <h5>{{ planDetail.name }}</h5>
                      <p>{{ planDetail.startDate }} - {{ planDetail.endDate }}</p>
                    </div>
                    <el-tag size="small" :type="statusTagType(planDetail.status)">{{
                      statusLabel(planDetail.status)
                    }}</el-tag>
                  </div>
                  <div class="phase-review-summary plan-review-summary">
                    <span>{{ t('plans.manager.reviewTotal') }}：{{ planReviewSummary.total }}</span>
                    <span class="phase-review-summary__success"
                      >{{ t('plans.manager.reviewAchieved') }}：{{ planReviewSummary.achieved }}</span
                    >
                    <span>{{ t('plans.manager.reviewPartial') }}：{{ planReviewSummary.partial }}</span>
                    <span>{{ t('plans.manager.reviewUnverifiable') }}：{{ planReviewSummary.unverifiable }}</span>
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
                    <span
                      v-if="
                        planReviewPhase.review.fatigueLevel !== null &&
                        planReviewPhase.review.fatigueLevel !== undefined
                      "
                    >
                      {{ t('plans.manager.reviewFatigue') }}：{{ planReviewPhase.review.fatigueLevel }}/10
                    </span>
                  </div>
                  <el-empty v-else :description="t('plans.manager.noReview')" :image-size="52" />
                </article>
              </section>
              <el-empty v-else :description="t('plans.manager.noPhases')" :image-size="64" />
            </el-tab-pane>
          </el-tabs>
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
                  <label
                    v-for="metric in metricsFor(item)"
                    :key="metric"
                    class="target-field"
                    :class="{ 'target-field--duration': metric === 'duration' }"
                  >
                    <span>{{ metricLabel(metric) }}</span>
                    <template v-if="metric === 'duration'">
                      <div class="duration-input-group">
                        <el-input-number
                          v-model="item.durationParts.hours"
                          :min="0"
                          :max="99"
                          :precision="0"
                          controls-position="right"
                        />
                        <small>{{ durationPartLabel('hours') }}</small>
                        <el-input-number
                          v-model="item.durationParts.minutes"
                          :min="0"
                          :max="59"
                          :precision="0"
                          controls-position="right"
                        />
                        <small>{{ durationPartLabel('minutes') }}</small>
                        <el-input-number
                          v-model="item.durationParts.seconds"
                          :min="0"
                          :max="59"
                          :precision="0"
                          controls-position="right"
                        />
                        <small>{{ durationPartLabel('seconds') }}</small>
                      </div>
                    </template>
                    <template v-else>
                      <el-input-number
                        v-model="item.targets[metric]"
                        :min="0"
                        :precision="metricPrecision(metric)"
                        controls-position="right"
                      />
                      <small>{{ unitLabel(metric) }}</small>
                    </template>
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
                  <label
                    v-for="metric in metricsFor(item)"
                    :key="metric"
                    class="target-field"
                    :class="{ 'target-field--duration': metric === 'duration' }"
                  >
                    <span>{{ metricLabel(metric) }}</span>
                    <template v-if="metric === 'duration'">
                      <div class="duration-input-group">
                        <el-input-number
                          v-model="item.durationParts.hours"
                          :min="0"
                          :max="99"
                          :precision="0"
                          controls-position="right"
                        />
                        <small>{{ durationPartLabel('hours') }}</small>
                        <el-input-number
                          v-model="item.durationParts.minutes"
                          :min="0"
                          :max="59"
                          :precision="0"
                          controls-position="right"
                        />
                        <small>{{ durationPartLabel('minutes') }}</small>
                        <el-input-number
                          v-model="item.durationParts.seconds"
                          :min="0"
                          :max="59"
                          :precision="0"
                          controls-position="right"
                        />
                        <small>{{ durationPartLabel('seconds') }}</small>
                      </div>
                    </template>
                    <template v-else>
                      <el-input-number
                        v-model="item.targets[metric]"
                        :min="0"
                        :precision="metricPrecision(metric)"
                        controls-position="right"
                      />
                      <small>{{ unitLabel(metric) }}</small>
                    </template>
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

    <el-dialog
      v-model="batchSessionDialogVisible"
      class="session-dialog batch-session-dialog"
      :title="t('plans.manager.batchTitle')"
      width="min(900px, calc(100vw - 32px))"
      top="5vh"
      destroy-on-close
    >
      <p class="batch-session-dialog__description">{{ t('plans.manager.batchDescription') }}</p>
      <el-form label-position="top" @submit.prevent>
        <div class="batch-session-fields">
          <el-form-item :label="t('plans.manager.dateRange')" required>
            <el-date-picker
              v-model="batchSessionForm.dates"
              class="full-width"
              type="daterange"
              value-format="YYYY-MM-DD"
              :disabled-date="batchSessionDateDisabled"
            />
          </el-form-item>
          <el-form-item :label="t('plans.manager.status')">
            <el-select v-model="batchSessionForm.status" class="full-width">
              <el-option v-for="status in sessionStatuses" :key="status" :label="statusLabel(status)" :value="status" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="batch-frequency-label">
                <span>{{ t('plans.manager.batchFrequency') }}</span>
                <span class="batch-frequency-count">
                  {{ t('plans.manager.batchPreview', { count: batchSessionDates.length }) }}
                </span>
              </span>
            </template>
            <el-select v-model="batchSessionForm.frequency" class="full-width">
              <el-option
                v-for="frequency in batchFrequencies"
                :key="frequency"
                :label="t(`plans.manager.batchFrequencies.${frequency}`)"
                :value="frequency"
              />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item v-if="batchSessionForm.frequency === 'weekdays'" :label="t('plans.manager.batchWeekdays')">
          <el-checkbox-group v-model="batchSessionForm.weekdays" class="weekday-options">
            <el-checkbox v-for="day in weekdayOptions" :key="day.value" :label="day.value">
              {{ day.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <p v-if="batchSessionForm.frequency === 'china_workdays' && chinaCalendarLoading" class="calendar-notice">
          {{ t('plans.manager.chinaCalendarLoading') }}
        </p>
        <p
          v-else-if="batchSessionForm.frequency === 'china_workdays' && chinaCalendarUnavailableYears.length"
          class="calendar-notice calendar-notice--warning"
        >
          {{
            t('plans.manager.chinaCalendarUnavailable', {
              years: chinaCalendarUnavailableYears.join(t('common.listSeparator'))
            })
          }}
        </p>

        <div class="training-items-heading">
          <span>{{ t('plans.manager.trainingItems') }}</span>
          <el-button :icon="Plus" :disabled="!canAddBatchSessionExercise" @click="addBatchSessionItem">
            {{ t('plans.manager.addTrainingItem') }}
          </el-button>
        </div>
        <div class="session-items-table-wrap">
          <el-table :data="batchSessionItems" border class="session-items-table">
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
                    v-for="exercise in batchSessionExerciseOptionsFor(item)"
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
                  <label
                    v-for="metric in metricsFor(item)"
                    :key="metric"
                    class="target-field"
                    :class="{ 'target-field--duration': metric === 'duration' }"
                  >
                    <span>{{ metricLabel(metric) }}</span>
                    <template v-if="metric === 'duration'">
                      <div class="duration-input-group">
                        <el-input-number
                          v-model="item.durationParts.hours"
                          :min="0"
                          :max="99"
                          :precision="0"
                          controls-position="right"
                        />
                        <small>{{ durationPartLabel('hours') }}</small>
                        <el-input-number
                          v-model="item.durationParts.minutes"
                          :min="0"
                          :max="59"
                          :precision="0"
                          controls-position="right"
                        />
                        <small>{{ durationPartLabel('minutes') }}</small>
                        <el-input-number
                          v-model="item.durationParts.seconds"
                          :min="0"
                          :max="59"
                          :precision="0"
                          controls-position="right"
                        />
                        <small>{{ durationPartLabel('seconds') }}</small>
                      </div>
                    </template>
                    <template v-else>
                      <el-input-number
                        v-model="item.targets[metric]"
                        :min="0"
                        :precision="metricPrecision(metric)"
                        controls-position="right"
                      />
                      <small>{{ unitLabel(metric) }}</small>
                    </template>
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
                    @click="removeBatchSessionItem($index)"
                  />
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-form-item :label="t('plans.manager.sessionNotes')">
          <el-input v-model="batchSessionForm.notes" type="textarea" :rows="3" maxlength="2000" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchSessionDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveBatchSessions">
          {{ t('plans.manager.generateSessions') }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="phaseReviewDialogVisible"
      class="phase-review-dialog"
      :title="phaseReviewDialogTitle"
      width="min(640px, calc(100vw - 32px))"
      destroy-on-close
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
        <el-button @click="phaseReviewDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="savePhaseReview">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
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
  createTrainingSessionsBatch,
  deleteTrainingPlan,
  deleteTrainingSession,
  getWeightData,
  getTrainingExercises,
  getChinaWorkdayCalendar,
  getTrainingPlan,
  getTrainingPlans,
  saveTrainingPhaseReview,
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
const planWeightData = ref(null);
const detailDrawerVisible = ref(false);
const planDetailTab = ref('calendar');
const planDialogVisible = ref(false);
const sessionDialogVisible = ref(false);
const batchSessionDialogVisible = ref(false);
const phaseReviewDialogVisible = ref(false);
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
const phaseReviewForm = reactive({
  phaseId: null,
  summary: '',
  fatigueLevel: null,
  discomfort: '',
  adjustment: ''
});
const batchSessionForm = reactive({
  dates: [],
  frequency: 'china_workdays',
  weekdays: [1, 2, 3, 4, 5],
  status: 'planned',
  notes: ''
});
const batchSessionItems = ref([]);
const batchRule = reactive({ frequency: 'china_workdays', weekdays: [1, 2, 3, 4, 5] });
const batchFrequencies = ['daily', 'china_workdays', 'weekdays', 'odd', 'even'];
const durationParts = ['hours', 'minutes', 'seconds'];
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
const canAddBatchSessionExercise = computed(() =>
  exercises.value.some(
    (exercise) => exercise.enabled && !batchSessionItems.value.some((item) => item.exerciseId === exercise.id)
  )
);

const isCreatingPlan = computed(() => !editingPlanId.value && planDialogVisible.value && planCreationStep.value === 1);
const isEditingSession = computed(() => Boolean(editingSessionId.value || editingDraftSessionKey.value));
const sessionDialogTitle = computed(() =>
  isEditingSession.value
    ? t('plans.manager.editSessionWithDate', { date: sessionForm.scheduledDate })
    : t('plans.manager.addSession')
);
const phaseReviewDialogTitle = computed(() =>
  planDetail.value?.name
    ? t('plans.manager.reviewDialogTitle', { name: planDetail.value.name })
    : t('plans.manager.phaseReviews')
);
const fatigueRatingTexts = computed(() => [
  t('plans.manager.fatigueRatingLow'),
  t('plans.manager.fatigueRatingMedium'),
  t('plans.manager.fatigueRatingHigh')
]);
const highFatigue = computed(() => Number(phaseReviewForm.fatigueLevel) > 6);
const batchSessionDates = computed(() =>
  getBatchDates(batchSessionForm.dates, batchSessionForm.frequency, batchSessionForm.weekdays)
);
watch(
  () => batchSessionForm.dates.slice(),
  (dates) => {
    if (batchSessionDialogVisible.value && dates.length === 2) loadChinaCalendarForRange(dates);
  }
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
const planReviewPhase = computed(() => {
  const phases = planDetail.value?.phases || [];
  return phases.find((phase) => phase.review) || phases[0] || null;
});
const planReviewSummary = computed(() => {
  const summary = { total: 0, achieved: 0, partial: 0, unverifiable: 0 };
  for (const session of planDetail.value?.sessions || []) {
    summary.total += 1;
    if (Object.prototype.hasOwnProperty.call(summary, session.status)) summary[session.status] += 1;
  }
  return summary;
});
const planWeightSummary = computed(() => {
  const dailyData = planWeightData.value?.dailyData || [];
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

function durationPartLabel(part) {
  return t(`plans.manager.units.durationParts.${durationParts.includes(part) ? part : 'seconds'}`);
}

function metricPrecision(metric) {
  return ['distance', 'weight', 'speed', 'incline'].includes(metric) ? 1 : 0;
}

function targetsText(item) {
  const entries = Object.entries(item.targets || {}).filter(
    ([metric]) => !['duration', 'durationSeconds', 'durationUnit'].includes(metric)
  );
  const parts = [];
  const seconds = durationSecondsFromTargets(item.targets || {}) || durationSecondsFromParts(item.durationParts);
  if (seconds > 0) parts.push(`${metricLabel('duration')} ${formatDurationText(seconds)}`);
  parts.push(...entries.map(([metric, value]) => `${metricLabel(metric)} ${value} ${unitLabel(metric)}`));
  return parts.length > 0 ? parts.join(t('common.listSeparator')) : t('plans.manager.noTargets');
}

function durationSecondsFromTargets(targets) {
  if (Number.isFinite(Number(targets.durationSeconds)) && Number(targets.durationSeconds) > 0) {
    return Number(targets.durationSeconds);
  }
  if (!Number.isFinite(Number(targets.duration)) || Number(targets.duration) <= 0) return 0;
  return Number(targets.duration) * (targets.durationUnit === 'seconds' ? 1 : 60);
}

function formatDurationText(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [
    hours > 0 ? `${hours}${durationPartLabel('hours')}` : '',
    minutes > 0 ? `${minutes}${durationPartLabel('minutes')}` : '',
    remainder > 0 || (hours === 0 && minutes === 0) ? `${remainder}${durationPartLabel('seconds')}` : ''
  ]
    .filter(Boolean)
    .join(' ');
}

async function loadPlanDetail(id) {
  if (!id) {
    planDetail.value = null;
    planWeightData.value = null;
    calendarMonth.value = '';
    calendarSelectedDate.value = '';
    return;
  }
  detailLoading.value = true;
  try {
    const loadedPlan = await getTrainingPlan(id);
    planDetail.value = loadedPlan;
    calendarMonth.value = planDetail.value.startDate.slice(0, 7);
    calendarSelectedDate.value = planDetail.value.sessions?.[0]?.scheduledDate || planDetail.value.startDate || '';
    try {
      planWeightData.value = await getWeightData({
        startDate: loadedPlan.startDate,
        endDate: loadedPlan.endDate
      });
    } catch {
      planWeightData.value = null;
    }
  } catch (requestError) {
    planWeightData.value = null;
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
  planDetailTab.value = 'calendar';
  error.value = '';
  await loadPlanDetail(id);
  if (planDetail.value) detailDrawerVisible.value = true;
}

function openPlanReviewDialog() {
  const phase = planReviewPhase.value;
  if (!phase) return;
  Object.assign(phaseReviewForm, {
    phaseId: phase.id,
    summary: phase.review?.summary || '',
    fatigueLevel: phase.review?.fatigueLevel ?? null,
    discomfort: phase.review?.discomfort || '',
    adjustment: phase.review?.adjustment || ''
  });
  phaseReviewDialogVisible.value = true;
}

async function savePhaseReview() {
  if (!phaseReviewForm.phaseId) return;
  if (highFatigue.value && !phaseReviewForm.discomfort.trim()) {
    ElMessage.warning(t('plans.manager.reviewDiscomfortRequired'));
    return;
  }
  if (highFatigue.value && !phaseReviewForm.adjustment.trim()) {
    ElMessage.warning(t('plans.manager.reviewAdjustmentRequired'));
    return;
  }
  saving.value = true;
  try {
    await saveTrainingPhaseReview(phaseReviewForm.phaseId, {
      summary: phaseReviewForm.summary,
      fatigueLevel: phaseReviewForm.fatigueLevel,
      discomfort: phaseReviewForm.discomfort,
      adjustment: phaseReviewForm.adjustment
    });
    phaseReviewDialogVisible.value = false;
    await loadPlanDetail(planDetail.value?.id);
    ElMessage.success(t('plans.manager.reviewSaved'));
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.saveFailed'));
  } finally {
    saving.value = false;
  }
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
        items: session.items.map((item) => ({ exerciseId: item.exerciseId, targets: targetPayload(item) }))
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
  const normalizedTargets = { ...targets };
  const durationPartsValue = durationPartsFromTargets(normalizedTargets);
  delete normalizedTargets.duration;
  delete normalizedTargets.durationSeconds;
  delete normalizedTargets.durationUnit;
  return { key: itemKey, exerciseId, durationParts: durationPartsValue, targets: normalizedTargets };
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
  return getBatchDates(planForm.dates, batchRule.frequency, batchRule.weekdays);
}

function getBatchDates(dateRange, frequency, weekdays) {
  const [startDate, endDate] = dateRange || [];
  if (!startDate || !endDate || startDate > endDate) return [];
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    const dayOfMonth = cursor.getUTCDate();
    const date = cursor.toISOString().slice(0, 10);
    const calendarDay = chinaCalendar.value.get(date);
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

function batchSessionDateDisabled(date) {
  const plan = planDetail.value;
  if (!plan) return true;
  const dateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  return dateKey < plan.startDate || dateKey > plan.endDate;
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
  let generatedCount = 0;
  let appendedCount = 0;
  dates.forEach((scheduledDate) => {
    const existingSession = draftSessions.value.find((session) => session.scheduledDate === scheduledDate);
    const newItems = batchItems.value
      .filter((item) => !existingSession?.items.some((existingItem) => existingItem.exerciseId === item.exerciseId))
      .map((item) => {
        const draftItem = createItem(item.exerciseId, item.targets);
        draftItem.durationParts = { ...item.durationParts };
        return draftItem;
      });
    if (existingSession) {
      existingSession.items.push(...newItems);
      if (newItems.length > 0) appendedCount += 1;
      return;
    }
    draftSessions.value.push({
      key: ++draftSessionKey,
      scheduledDate,
      notes: '',
      status: 'planned',
      items: newItems
    });
    generatedCount += 1;
  });
  if (generatedCount > 0 && appendedCount > 0) {
    ElMessage.success(t('plans.manager.batchMixed', { generated: generatedCount, appended: appendedCount }));
  } else if (appendedCount > 0) {
    ElMessage.success(t('plans.manager.batchAppended', { count: appendedCount }));
  } else {
    ElMessage.success(t('plans.manager.batchGenerated', { count: generatedCount }));
  }
}

function isChinaWorkday(date, override) {
  if (override?.type === 'transfer_workday') return true;
  if (override?.type === 'public_holiday') return false;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

function batchSessionExerciseOptionsFor(currentItem) {
  const selectedIds = new Set(
    batchSessionItems.value.filter((item) => item !== currentItem).map((item) => item.exerciseId)
  );
  return exercises.value.filter(
    (exercise) => !selectedIds.has(exercise.id) && (exercise.enabled || exercise.id === currentItem.exerciseId)
  );
}

function addBatchSessionItem() {
  const exercise = exercises.value.find(
    (candidate) => candidate.enabled && !batchSessionItems.value.some((item) => item.exerciseId === candidate.id)
  );
  if (!exercise) return;
  const item = createItem(exercise.id);
  batchSessionItems.value.push(item);
  resetItemTargets(item);
}

function removeBatchSessionItem(index) {
  batchSessionItems.value.splice(index, 1);
}

async function openBatchSessionDialog() {
  const plan = planDetail.value;
  if (!plan) return;
  Object.assign(batchSessionForm, {
    dates: [plan.startDate, plan.endDate],
    frequency: 'china_workdays',
    weekdays: [1, 2, 3, 4, 5],
    status: 'planned',
    notes: ''
  });
  batchSessionItems.value = [];
  addBatchSessionItem();
  batchSessionDialogVisible.value = true;
}

async function loadChinaCalendarForRange(dateRange) {
  chinaCalendarLoading.value = true;
  chinaCalendarUnavailableYears.value = [];
  try {
    const response = await getChinaWorkdayCalendar({ startDate: dateRange[0], endDate: dateRange[1] });
    chinaCalendar.value = new Map(response.overrides.map((day) => [day.date, day]));
    chinaCalendarUnavailableYears.value = response.unavailableYears || [];
  } catch (requestError) {
    chinaCalendar.value = new Map();
    const startYear = Number(dateRange[0]?.slice(0, 4));
    const endYear = Number(dateRange[1]?.slice(0, 4));
    chinaCalendarUnavailableYears.value = Array.from(
      { length: endYear - startYear + 1 },
      (_, index) => startYear + index
    ).filter(Number.isInteger);
    ElMessage.warning(normalizeRequestError(requestError, t) || t('plans.manager.chinaCalendarLoadFailed'));
  } finally {
    chinaCalendarLoading.value = false;
  }
}

async function saveBatchSessions() {
  if (batchSessionForm.dates.length !== 2) return ElMessage.warning(t('plans.manager.datesRequired'));
  if (chinaCalendarLoading.value && batchSessionForm.frequency === 'china_workdays') {
    return ElMessage.warning(t('plans.manager.chinaCalendarLoading'));
  }
  if (batchSessionForm.frequency === 'weekdays' && batchSessionForm.weekdays.length === 0) {
    return ElMessage.warning(t('plans.manager.batchWeekdaysRequired'));
  }
  if (batchSessionForm.frequency === 'china_workdays' && chinaCalendarUnavailableYears.value.length > 0) {
    return ElMessage.warning(
      t('plans.manager.chinaCalendarUnavailable', {
        years: chinaCalendarUnavailableYears.value.join(t('common.listSeparator'))
      })
    );
  }
  if (batchSessionItems.value.length === 0) return ElMessage.warning(t('plans.manager.itemsRequired'));
  if (batchSessionItems.value.some((item) => !item.exerciseId)) {
    return ElMessage.warning(t('plans.manager.exerciseRequired'));
  }
  const dates = batchSessionDates.value;
  if (dates.length === 0) return ElMessage.warning(t('plans.manager.batchNoDates'));

  const items = batchSessionItems.value.map((item) => ({
    exerciseId: item.exerciseId,
    targets: targetPayload(item)
  }));
  saving.value = true;
  try {
    const response = await createTrainingSessionsBatch(
      planDetail.value.id,
      dates.map((scheduledDate) => ({
        scheduledDate,
        notes: batchSessionForm.notes,
        status: batchSessionForm.status,
        items
      }))
    );
    batchSessionDialogVisible.value = false;
    await loadPlans(planDetail.value.id);
    const generatedCount = Number(response?.createdCount || 0);
    const appendedCount = Number(response?.updatedCount || 0);
    if (generatedCount > 0 && appendedCount > 0) {
      ElMessage.success(t('plans.manager.batchMixed', { generated: generatedCount, appended: appendedCount }));
    } else if (appendedCount > 0) {
      ElMessage.success(t('plans.manager.batchAppended', { count: appendedCount }));
    } else {
      ElMessage.success(t('plans.manager.batchGenerated', { count: generatedCount }));
    }
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.saveFailed'));
  } finally {
    saving.value = false;
  }
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
  item.durationParts = { hours: 0, minutes: 0, seconds: 0 };
}

function targetPayload(item) {
  const targets = Object.fromEntries(
    Object.entries(item.targets).filter(
      ([metric, value]) =>
        !['duration', 'durationSeconds', 'durationUnit'].includes(metric) &&
        Number.isFinite(Number(value)) &&
        Number(value) > 0
    )
  );
  if (metricsFor(item).includes('duration')) {
    const seconds = durationSecondsFromParts(item.durationParts);
    if (seconds > 0) targets.durationSeconds = seconds;
  }
  return targets;
}

function durationPartsFromTargets(targets) {
  return durationPartsFromSeconds(durationSecondsFromTargets(targets));
}

function durationPartsFromSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60
  };
}

function durationSecondsFromParts(parts = {}) {
  const hours = Math.max(0, Number(parts.hours) || 0);
  const minutes = Math.max(0, Number(parts.minutes) || 0);
  const seconds = Math.max(0, Number(parts.seconds) || 0);
  return Math.round(hours * 3600 + minutes * 60 + seconds);
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
      targets: targetPayload(item)
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
.batch-session-dialog__description {
  margin: 0 0 16px;
  color: var(--text-secondary);
  font-size: 13px;
}
.batch-session-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}
.batch-session-fields .el-form-item {
  min-width: 0;
}
.batch-frequency-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.batch-frequency-count {
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 500;
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
.plan-detail-tabs {
  margin-top: 4px;
}
.plan-detail-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.plan-detail-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: var(--card-border);
}
.plan-detail-tabs :deep(.el-tabs__item) {
  height: 42px;
  padding: 0 14px;
  color: var(--text-secondary);
  font-size: 13px;
}
.plan-detail-tabs :deep(.el-tabs__item.is-active) {
  color: var(--primary-color);
  font-weight: 600;
}
.plan-detail-tabs :deep(.el-tabs__content) {
  overflow: visible;
}
.plan-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}
.plan-tab-label :deep(.el-tag) {
  height: 20px;
  line-height: 18px;
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
.section-heading p {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
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
.phase-review-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.phase-review-form-grid .el-input-number {
  width: 100%;
}
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
  grid-template-columns: repeat(auto-fit, minmax(120px, max-content));
  justify-content: start;
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
.target-field--duration {
  grid-column: 1 / -1;
}
.duration-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
}
.target-field .duration-input-group :deep(.el-input-number) {
  width: 84px;
  min-width: 84px;
  flex: none;
}
.duration-input-group small {
  min-width: 12px;
  margin-right: 2px;
}
.target-field :deep(.el-input-number) {
  width: auto;
  min-width: 72px;
  flex: 1;
}
.session-target-grid .target-field:not(.target-field--duration) :deep(.el-input-number) {
  width: 88px;
  min-width: 88px;
  flex: none;
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
  .section-heading,
  .phase-header,
  .plan-review-card__meta,
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
  .batch-session-fields,
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
  .phase-review-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>

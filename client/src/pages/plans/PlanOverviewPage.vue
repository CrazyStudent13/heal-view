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
            <div class="plan-cell-name">{{ row.name }}</div>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.manager.planGoal')" min-width="240">
          <template #default="{ row }">
            <span class="plan-cell-goal">{{ row.goal || t('common.empty') }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('nav.startDate')" width="118" prop="startDate" />
        <el-table-column :label="t('nav.endDate')" width="118" prop="endDate" />
        <el-table-column :label="t('plans.manager.status')" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.manager.phases')" width="92" align="center" prop="phaseCount" />
        <el-table-column :label="t('plans.sessions.title')" width="104" align="center" prop="sessionCount" />
        <el-table-column :label="t('plans.sessions.actions')" width="104" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="selectPlan(row.id)">{{
              t('plans.sessions.viewPlan')
            }}</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('plans.overviewEmpty')" :image-size="76" />
        </template>
      </el-table>
    </div>

    <el-drawer v-model="detailDrawerVisible" size="min(960px, 94vw)" :with-header="false" destroy-on-close>
      <main v-loading="detailLoading" class="plan-detail">
        <template v-if="planDetail">
          <header class="plan-detail-header">
            <div class="plan-detail-title">
              <div class="plan-detail-title__line">
                <h3>{{ planDetail.name }}</h3>
                <el-tag :type="statusTagType(planDetail.status)">{{ statusLabel(planDetail.status) }}</el-tag>
              </div>
              <p>{{ planDetail.startDate }} - {{ planDetail.endDate }}</p>
              <p v-if="planDetail.goal" class="plan-goal">{{ planDetail.goal }}</p>
            </div>
            <div class="plan-detail-actions">
              <el-button :icon="EditPen" @click="openPlanDialog(planDetail)">{{ t('common.edit') }}</el-button>
              <el-button :icon="Plus" @click="openPhaseDialog()">{{ t('plans.manager.addPhase') }}</el-button>
              <el-button type="primary" :icon="Plus" @click="openSessionDialog()">{{
                t('plans.manager.addSession')
              }}</el-button>
            </div>
          </header>

          <div v-if="planDetail.phases.length === 0" class="phase-empty">
            <el-empty :description="t('plans.manager.noPhases')" :image-size="96">
              <el-button type="primary" :icon="Plus" @click="openPhaseDialog()">{{
                t('plans.manager.addPhase')
              }}</el-button>
            </el-empty>
          </div>

          <div v-else class="phase-list">
            <section v-for="phase in planDetail.phases" :key="phase.id" class="phase-section">
              <header class="phase-header">
                <div>
                  <div class="phase-title-line">
                    <h4>{{ phase.name }}</h4>
                    <el-tag size="small" :type="statusTagType(phase.status)">{{ statusLabel(phase.status) }}</el-tag>
                  </div>
                  <p>{{ phase.startDate }} - {{ phase.endDate }}</p>
                  <p v-if="phase.description" class="phase-description">{{ phase.description }}</p>
                </div>
                <div class="phase-actions">
                  <el-tooltip :content="t('plans.manager.editPhase')" placement="top">
                    <el-button
                      circle
                      :icon="EditPen"
                      :aria-label="t('plans.manager.editPhase')"
                      @click="openPhaseDialog(phase)"
                    />
                  </el-tooltip>
                  <el-popconfirm
                    :title="t('plans.manager.confirmDeletePhase', { name: phase.name })"
                    :width="280"
                    confirm-button-type="danger"
                    :confirm-button-text="t('common.delete')"
                    :cancel-button-text="t('common.cancel')"
                    @confirm="removePhase(phase)"
                  >
                    <template #reference>
                      <el-button circle type="danger" plain :icon="Delete" :aria-label="t('common.delete')" />
                    </template>
                  </el-popconfirm>
                </div>
              </header>
            </section>
          </div>

          <section class="plan-sessions-section">
            <h4>{{ t('plans.sessions.title') }}</h4>
            <div v-if="planDetail.sessions.length === 0" class="session-empty">
              <span>{{ t('plans.manager.noSessions') }}</span>
            </div>

            <div v-else class="session-list">
              <article v-for="session in planDetail.sessions" :key="session.id" class="session-row">
                <time class="session-date" :datetime="session.scheduledDate">{{ session.scheduledDate }}</time>
                <div class="session-main">
                  <div class="session-items">
                    <div v-for="item in session.items" :key="item.id" class="session-item">
                      <span>{{ item.exercise.name }}</span>
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
                    @confirm="removeSession(session)"
                  >
                    <template #reference>
                      <el-button circle type="danger" plain :icon="Delete" :aria-label="t('common.delete')" />
                    </template>
                  </el-popconfirm>
                </div>
              </article>
            </div>
          </section>
        </template>
      </main>
    </el-drawer>

    <el-dialog
      v-model="planDialogVisible"
      :title="editingPlanId ? t('plans.manager.editPlan') : t('plans.manager.addPlan')"
      width="min(620px, calc(100vw - 32px))"
      destroy-on-close
    >
      <el-form label-position="top" @submit.prevent>
        <el-form-item :label="t('plans.manager.planName')" required>
          <el-input
            v-model="planForm.name"
            maxlength="100"
            show-word-limit
            :placeholder="t('plans.manager.planNamePlaceholder')"
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
        <el-form-item :label="t('plans.manager.planGoal')">
          <el-input
            v-model="planForm.goal"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            :placeholder="t('plans.manager.planGoalPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('plans.manager.planNotes')">
          <el-input v-model="planForm.notes" type="textarea" :rows="3" maxlength="2000" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="planDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="savePlan">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="phaseDialogVisible"
      :title="editingPhaseId ? t('plans.manager.editPhase') : t('plans.manager.addPhase')"
      width="min(620px, calc(100vw - 32px))"
      destroy-on-close
    >
      <el-form label-position="top" @submit.prevent>
        <el-form-item :label="t('plans.manager.phaseName')" required>
          <el-input
            v-model="phaseForm.name"
            maxlength="100"
            show-word-limit
            :placeholder="t('plans.manager.phaseNamePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('plans.manager.dateRange')" required>
          <el-date-picker v-model="phaseForm.dates" class="full-width" type="daterange" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item :label="t('plans.manager.status')">
          <el-select v-model="phaseForm.status" class="full-width">
            <el-option v-for="status in phaseStatuses" :key="status" :label="statusLabel(status)" :value="status" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('plans.manager.phaseDescription')">
          <el-input
            v-model="phaseForm.description"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
            :placeholder="t('plans.manager.phaseDescriptionPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('plans.manager.adjustmentReason')">
          <el-input
            v-model="phaseForm.adjustmentReason"
            type="textarea"
            :rows="2"
            maxlength="1000"
            show-word-limit
            :placeholder="t('plans.manager.adjustmentReasonPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="phaseDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="savePhase">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="sessionDialogVisible"
      :title="editingSessionId ? t('plans.manager.editSession') : t('plans.manager.addSession')"
      width="min(820px, calc(100vw - 32px))"
      top="6vh"
      destroy-on-close
    >
      <el-form label-position="top" @submit.prevent>
        <el-form-item :label="t('plans.manager.sessionDate')" required>
          <el-date-picker
            v-model="sessionForm.scheduledDate"
            class="session-date-input"
            type="date"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>

        <div class="training-items-heading">
          <span>{{ t('plans.manager.trainingItems') }}</span>
          <el-button :icon="Plus" :disabled="!canAddExercise" @click="addSessionItem">{{
            t('plans.manager.addTrainingItem')
          }}</el-button>
        </div>

        <div class="training-item-list">
          <div v-for="(item, index) in sessionForm.items" :key="item.key" class="training-item-editor">
            <div class="training-item-editor__top">
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
              <el-tooltip :content="t('common.delete')" placement="top">
                <el-button
                  circle
                  type="danger"
                  plain
                  :icon="Delete"
                  :aria-label="t('common.delete')"
                  @click="removeSessionItem(index)"
                />
              </el-tooltip>
            </div>
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
          </div>
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
import { Delete, EditPen, Plus } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import { normalizeRequestError } from '@/utils/requestState.js';
import {
  createTrainingPhase,
  createTrainingPlan,
  createTrainingSession,
  deleteTrainingPhase,
  deleteTrainingSession,
  getTrainingExercises,
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
const phaseDialogVisible = ref(false);
const sessionDialogVisible = ref(false);
const editingPlanId = ref(null);
const editingPhaseId = ref(null);
const editingSessionId = ref(null);
let itemKey = 0;

const planStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];
const phaseStatuses = ['planned', 'active', 'paused', 'completed', 'cancelled'];
const planForm = reactive({ name: '', dates: [], status: 'draft', goal: '', notes: '' });
const phaseForm = reactive({ name: '', dates: [], status: 'planned', description: '', adjustmentReason: '' });
const sessionForm = reactive({ scheduledDate: '', notes: '', status: 'planned', items: [] });

const canAddExercise = computed(() =>
  exercises.value.some(
    (exercise) => exercise.enabled && !sessionForm.items.some((item) => item.exerciseId === exercise.id)
  )
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
    return;
  }
  detailLoading.value = true;
  try {
    planDetail.value = await getTrainingPlan(id);
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
  if (id === selectedPlanId.value) return;
  selectedPlanId.value = id;
  error.value = '';
  await loadPlanDetail(id);
  if (planDetail.value) detailDrawerVisible.value = true;
}

function openPlanDialog(plan = null) {
  editingPlanId.value = plan?.id || null;
  Object.assign(planForm, {
    name: plan?.name || '',
    dates: plan ? [plan.startDate, plan.endDate] : [],
    status: plan?.status || 'draft',
    goal: plan?.goal || '',
    notes: plan?.notes || ''
  });
  planDialogVisible.value = true;
}

async function savePlan() {
  if (!planForm.name.trim()) return ElMessage.warning(t('plans.manager.nameRequired'));
  if (planForm.dates.length !== 2) return ElMessage.warning(t('plans.manager.datesRequired'));
  saving.value = true;
  try {
    const payload = {
      name: planForm.name,
      startDate: planForm.dates[0],
      endDate: planForm.dates[1],
      status: planForm.status,
      goal: planForm.goal,
      notes: planForm.notes
    };
    const saved = editingPlanId.value
      ? await updateTrainingPlan(editingPlanId.value, payload)
      : await createTrainingPlan(payload);
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

function openPhaseDialog(phase = null) {
  editingPhaseId.value = phase?.id || null;
  Object.assign(phaseForm, {
    name: phase?.name || '',
    dates: phase ? [phase.startDate, phase.endDate] : [planDetail.value.startDate, planDetail.value.endDate],
    status: phase?.status || 'planned',
    description: phase?.description || '',
    adjustmentReason: phase?.adjustmentReason || ''
  });
  phaseDialogVisible.value = true;
}

async function savePhase() {
  if (!phaseForm.name.trim()) return ElMessage.warning(t('plans.manager.nameRequired'));
  if (phaseForm.dates.length !== 2) return ElMessage.warning(t('plans.manager.datesRequired'));
  saving.value = true;
  try {
    const payload = {
      name: phaseForm.name,
      startDate: phaseForm.dates[0],
      endDate: phaseForm.dates[1],
      status: phaseForm.status,
      description: phaseForm.description,
      adjustmentReason: phaseForm.adjustmentReason
    };
    if (editingPhaseId.value) await updateTrainingPhase(editingPhaseId.value, payload);
    else await createTrainingPhase(planDetail.value.id, payload);
    phaseDialogVisible.value = false;
    await loadPlans(planDetail.value.id);
    ElMessage.success(t('plans.manager.saved'));
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.saveFailed'));
  } finally {
    saving.value = false;
  }
}

async function removePhase(phase) {
  try {
    await deleteTrainingPhase(phase.id);
    await loadPlans(planDetail.value.id);
    ElMessage.success(t('plans.manager.phaseDeleted'));
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.deleteFailed'));
  }
}

function createItem(exerciseId = null, targets = {}) {
  itemKey += 1;
  return { key: itemKey, exerciseId, targets: { ...targets } };
}

function openSessionDialog(session = null) {
  editingSessionId.value = session?.id || null;
  Object.assign(sessionForm, {
    scheduledDate: session?.scheduledDate || planDetail.value.startDate,
    notes: session?.notes || '',
    status: session?.status || 'planned',
    items: session?.items.map((item) => createItem(item.exerciseId, item.targets)) || []
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
  saving.value = true;
  try {
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
.plan-detail {
  min-width: 0;
  overflow: auto;
  padding: 20px;
}
.plan-detail-header,
.phase-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.plan-detail-header {
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
.plan-goal,
.phase-description {
  max-width: 720px;
  line-height: 1.55;
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
}
.session-row:last-child {
  border-bottom: 0;
}
.session-date {
  color: var(--text-secondary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.session-main {
  min-width: 0;
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
.session-date-input {
  width: min(280px, 100%);
}
.session-form-grid {
  display: grid;
  grid-template-columns: minmax(180px, 0.7fr) minmax(240px, 1.3fr);
  gap: 16px;
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
.training-item-editor {
  padding: 14px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--app-bg);
}
.training-item-editor__top {
  gap: 10px;
}
.exercise-select {
  flex: 1;
}
.target-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.target-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 12px;
}
.target-field > span {
  grid-column: 1 / -1;
}
.target-field :deep(.el-input-number) {
  width: 100%;
}
.target-field small {
  min-width: 34px;
}
.no-targets {
  margin-top: 12px;
  font-size: 12px;
}

@media (max-width: 900px) {
  .plan-table-region {
    overflow: auto;
  }
}

@media (max-width: 640px) {
  .plan-content-header,
  .plan-detail-header,
  .phase-header {
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
  .session-date {
    grid-column: 1 / -1;
  }
  .session-form-grid,
  .target-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEditingPlan ? t('plans.manager.editPlan') : t('plans.manager.addPlan')"
    width="min(960px, calc(100vw - 32px))"
    class="plan-dialog"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-steps
      v-if="!isEditingPlan"
      :active="planCreationStep"
      finish-status="success"
      simple
      class="plan-creation-steps"
    >
      <el-step :title="t('plans.manager.creationPlanInfo')" />
      <el-step :title="t('plans.manager.creationSessions')" />
    </el-steps>

    <!-- 两步之间用 v-show 而不是 v-if：退回上一步改日期再回来时，批量规则和草稿训练课都还在。 -->
    <el-form v-show="isEditingPlan || planCreationStep === 0" class="plan-form" label-position="top" @submit.prevent>
      <el-form-item :label="t('plans.manager.planName')" required>
        <el-input
          v-model="planForm.name"
          maxlength="45"
          show-word-limit
          :placeholder="t('plans.manager.planNamePlaceholder')"
        />
      </el-form-item>
      <div class="plan-form-grid">
        <el-form-item :label="t('plans.manager.phaseName')">
          <el-input
            v-model="planForm.phaseName"
            maxlength="30"
            show-word-limit
            :placeholder="t('plans.manager.phaseNamePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('plans.manager.dateRange')" required>
          <el-date-picker v-model="planForm.dates" class="full-width" type="daterange" value-format="YYYY-MM-DD" />
        </el-form-item>
      </div>
      <el-form-item :label="t('plans.manager.planGoal')">
        <el-input
          v-model="planForm.goal"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          maxlength="1000"
          show-word-limit
          :placeholder="t('plans.manager.planGoalPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('plans.manager.planNotes')">
        <el-input
          v-model="planForm.notes"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          maxlength="2000"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <section v-show="!isEditingPlan && planCreationStep === 1" class="plan-draft-sessions">
      <PlanBatchRuleEditor
        :exercises="exercises"
        :date-range="planForm.dates"
        :china-calendar="chinaCalendar"
        :calendar-unavailable-years="chinaCalendarUnavailableYears"
        :calendar-loading="chinaCalendarLoading"
        @generate="mergeGeneratedSessions"
      />

      <header class="plan-draft-sessions__header">
        <div>
          <h3>{{ t('plans.sessions.title') }}</h3>
          <p class="draft-count">{{ t('plans.manager.draftSessionsCount', { count: draftSessions.length }) }}</p>
        </div>
        <el-button :icon="Plus" @click="openDraftSessionDialog()">{{ t('plans.manager.addSession') }}</el-button>
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
                @click="openDraftSessionDialog(session)"
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
      <el-button @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</el-button>
      <template v-if="isEditingPlan">
        <el-button type="primary" :loading="saving" @click="submitPlanUpdate">{{ t('common.save') }}</el-button>
      </template>
      <template v-else-if="planCreationStep === 0">
        <el-button :loading="saving" @click="submitPlanCreate">{{ t('plans.manager.createPlanOnly') }}</el-button>
        <el-button type="primary" @click="nextPlanCreationStep">{{ t('plans.manager.nextStep') }}</el-button>
      </template>
      <template v-else>
        <el-button @click="planCreationStep = 0">{{ t('plans.manager.previousStep') }}</el-button>
        <el-button type="primary" :loading="saving" @click="submitPlanWithSessions">{{
          t('plans.manager.createPlanWithSessions')
        }}</el-button>
      </template>
    </template>
  </el-dialog>

  <!-- 草稿训练课的编辑弹窗和计划弹窗并列，不嵌在它内部：两个弹窗层级互不干扰。 -->
  <SessionFormDialog
    v-model="sessionDialogVisible"
    :session="sessionDialogSession"
    :exercises="exercises"
    :default-date="planForm.dates[0] || ''"
    @submit="handleSessionSubmit"
  />
</template>

<script setup>
import { computed, reactive, ref, toRef, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Delete, EditPen, Plus } from '@element-plus/icons-vue';
import PlanBatchRuleEditor from '@/pages/plans/components/PlanBatchRuleEditor.vue';
import SessionFormDialog from '@/pages/plans/components/SessionFormDialog.vue';
import { useChinaCalendar } from '@/pages/plans/composables/useChinaCalendar.js';
import { usePlanLabels } from '@/pages/plans/composables/usePlanLabels.js';
import { useTrainingItemEditor } from '@/pages/plans/composables/useTrainingItemEditor.js';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 编辑已有计划时是计划详情（含 phases），新建时为 null。 */
  plan: { type: Object, default: null },
  exercises: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue', 'submit']);

const { t } = useLocaleStore();
const { statusLabel, statusTagType } = usePlanLabels();
const { createItem, exerciseFor, hasCompleteTargets, targetPayload, targetsText } = useTrainingItemEditor(
  toRef(props, 'exercises')
);
const { chinaCalendar, chinaCalendarUnavailableYears, chinaCalendarLoading, loadChinaCalendar } = useChinaCalendar();

const isEditingPlan = computed(() => Boolean(props.plan?.id));
const planCreationStep = ref(0);
const draftSessions = ref([]);
const sessionDialogVisible = ref(false);
const sessionDialogSession = ref(null);
const planForm = reactive({ name: '', phaseName: '', dates: [], goal: '', notes: '' });
let draftSessionKey = 0;

const draftSessionsSorted = computed(() =>
  [...draftSessions.value].sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate))
);

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) initializeForm();
  },
  { immediate: true }
);

function initializeForm() {
  planCreationStep.value = 0;
  draftSessions.value = [];
  sessionDialogSession.value = null;
  Object.assign(planForm, {
    name: props.plan?.name || '',
    phaseName: props.plan?.phases?.[0]?.name || props.plan?.phaseName || '',
    dates: props.plan ? [props.plan.startDate, props.plan.endDate] : [],
    goal: props.plan?.goal || '',
    notes: props.plan?.notes || ''
  });
}

function planPayload() {
  return {
    name: planForm.name,
    startDate: planForm.dates[0],
    endDate: planForm.dates[1],
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
    if (session.items.some((item) => !hasCompleteTargets(item))) {
      ElMessage.warning(t('plans.manager.draftTargetRequired', { date: session.scheduledDate }));
      return false;
    }
    dates.add(session.scheduledDate);
  }
  return true;
}

function submitPlanUpdate() {
  if (!validatePlanForm()) return;
  emit('submit', {
    type: 'update',
    planId: props.plan.id,
    plan: planPayload(),
    phaseName: planForm.phaseName
  });
}

function submitPlanCreate() {
  if (!validatePlanForm()) return;
  emit('submit', { type: 'create', plan: planPayload(), phaseName: planForm.phaseName });
}

function submitPlanWithSessions() {
  if (!validatePlanForm() || !validateDraftSessions()) return;
  emit('submit', {
    type: 'createWithSessions',
    plan: planPayload(),
    phaseName: planForm.phaseName,
    sessions: draftSessions.value.map((session) => ({
      scheduledDate: session.scheduledDate,
      notes: session.notes,
      status: session.status,
      items: session.items.map((item) => ({ exerciseId: item.exerciseId, targets: targetPayload(item) }))
    }))
  });
}

async function nextPlanCreationStep() {
  if (!validatePlanForm()) return;
  planCreationStep.value = 1;
  await loadChinaCalendar(planForm.dates);
}

/** 批量规则只给出「哪些天、哪些项目」，和已有草稿的合并规则留在计划弹窗里。 */
function mergeGeneratedSessions({ dates, items }) {
  let generatedCount = 0;
  let appendedCount = 0;
  dates.forEach((scheduledDate) => {
    const existingSession = draftSessions.value.find((session) => session.scheduledDate === scheduledDate);
    const newItems = items
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

function openDraftSessionDialog(session = null) {
  sessionDialogSession.value = session;
  sessionDialogVisible.value = true;
}

function handleSessionSubmit(payload) {
  const key = sessionDialogSession.value?.key || ++draftSessionKey;
  if (payload.scheduledDate < planForm.dates[0] || payload.scheduledDate > planForm.dates[1]) {
    return ElMessage.warning(t('plans.manager.sessionOutsidePlan'));
  }
  if (draftSessions.value.some((session) => session.scheduledDate === payload.scheduledDate && session.key !== key)) {
    return ElMessage.warning(t('plans.manager.sessionDateExists'));
  }
  const draft = { key, ...payload };
  const index = draftSessions.value.findIndex((session) => session.key === draft.key);
  if (index === -1) draftSessions.value.push(draft);
  else draftSessions.value.splice(index, 1, draft);
  sessionDialogVisible.value = false;
}

function removeDraftSession(key) {
  draftSessions.value = draftSessions.value.filter((session) => session.key !== key);
}
</script>

<style scoped lang="scss">
@use '../styles/dialogShared';
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

.draft-count {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}

.plan-draft-sessions__list {
  margin-bottom: 20px;
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
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 3px;
  color: var(--text-primary);
  font-size: 13px;
}

.session-item small,
.session-notes {
  color: var(--text-secondary);
}

.session-notes {
  margin-top: 9px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.session-actions {
  display: flex;
  flex: none;
  gap: 8px;
}

@media (max-width: 760px) {
  .plan-form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .plan-draft-sessions__header {
    flex-direction: column;
  }

  .session-row {
    grid-template-columns: 1fr auto;
  }

  .session-date-block {
    grid-column: 1 / -1;
  }

  .plan-form-grid {
    grid-template-columns: 1fr !important;
  }
}
</style>

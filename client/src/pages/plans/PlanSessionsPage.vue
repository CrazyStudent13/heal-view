<template>
  <section class="sessions-page">
    <header class="sessions-header">
      <div>
        <h2>{{ t('plans.sessions.title') }}</h2>
        <p>{{ t('plans.sessions.pageDescription') }}</p>
      </div>
      <el-tooltip :content="t('common.refresh')" placement="top">
        <el-button circle :icon="Refresh" :loading="loading" :aria-label="t('common.refresh')" @click="loadSessions" />
      </el-tooltip>
    </header>

    <div class="sessions-toolbar">
      <el-input
        v-model="search"
        class="session-search-filter"
        clearable
        maxlength="60"
        :placeholder="t('plans.sessions.filterSearch')"
        :aria-label="t('plans.sessions.filterSearch')"
        @keyup.enter="applyFilters"
        @clear="applyFilters"
      />
      <el-date-picker
        v-model="dateRange"
        class="session-date-filter"
        type="daterange"
        value-format="YYYY-MM-DD"
        :start-placeholder="t('nav.startDate')"
        :end-placeholder="t('nav.endDate')"
        :aria-label="t('plans.sessions.filterDate')"
        @change="applyFilters"
      />
      <el-select
        v-model="planId"
        class="session-plan-filter"
        clearable
        :placeholder="t('plans.sessions.filterPlan')"
        @change="applyFilters"
      >
        <el-option :label="t('plans.sessions.allPlans')" value="" />
        <el-option v-for="plan in plans" :key="plan.id" :label="plan.name" :value="plan.id" />
      </el-select>
      <el-select
        v-model="status"
        class="session-status-filter"
        clearable
        :placeholder="t('plans.sessions.filterStatus')"
        @change="applyFilters"
      >
        <el-option :label="t('plans.sessions.allStatuses')" value="" />
        <el-option
          v-for="sessionStatus in sessionStatuses"
          :key="sessionStatus"
          :label="statusLabel(sessionStatus)"
          :value="sessionStatus"
        />
      </el-select>
      <el-select
        v-model="logged"
        class="session-logged-filter"
        clearable
        :placeholder="t('plans.sessions.filterLogged')"
        @change="applyFilters"
      >
        <el-option :label="t('plans.sessions.allLogged')" value="" />
        <el-option :label="t('plans.sessions.logged')" value="true" />
        <el-option :label="t('plans.sessions.loggedNo')" value="false" />
      </el-select>
      <el-button :icon="Search" @click="applyFilters">{{ t('common.query') }}</el-button>
      <el-button :icon="RefreshLeft" @click="resetFilters">{{ t('common.reset') }}</el-button>
      <div class="sessions-toolbar-actions">
        <el-button
          type="danger"
          plain
          :icon="DeleteIcon"
          :disabled="selectedCount === 0"
          @click="openSelectedDeleteDialog"
          >{{ t('plans.sessions.batchDelete', { count: selectedCount }) }}</el-button
        >
        <el-button type="danger" :icon="DeleteIcon" :loading="previewing" @click="openFilteredDeleteDialog">{{
          t('plans.sessions.batchDeleteFiltered')
        }}</el-button>
      </div>
    </div>

    <p v-if="selectedCount > 0" class="sessions-selection">
      <span>{{ t('plans.sessions.selectedCount', { count: selectedCount }) }}</span>
      <el-button link type="primary" @click="clearSelection">{{ t('plans.sessions.clearSelection') }}</el-button>
    </p>

    <el-alert v-if="error" class="sessions-alert" type="error" :title="error" show-icon :closable="false" />

    <div class="sessions-table-region">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="sessions"
        height="100%"
        class="sessions-table"
        row-key="id"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="48" reserve-selection />
        <el-table-column :label="t('plans.sessions.date')" width="164">
          <template #default="{ row }">
            <div class="session-date-cell">
              <time :datetime="row.scheduledDate">{{ row.scheduledDate }}</time>
              <el-tag v-if="row.execution" class="session-logged-tag" size="small" type="info" effect="plain">{{
                t('plans.sessions.logged')
              }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.sessions.plan')" min-width="150" prop="planName" />
        <el-table-column :label="t('plans.manager.status')" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.sessions.exercises')" min-width="300">
          <template #default="{ row }">
            <el-tooltip placement="top" popper-class="session-content-tooltip" :show-after="300">
              <template #content>
                <div
                  v-for="(exercise, index) in row.exercises"
                  :key="`${exercise.name}-${index}`"
                  class="session-tooltip-line"
                >
                  {{ exercise.name }} {{ targetsText(exercise.targets) }}
                </div>
              </template>
              <div class="session-exercises-summary">{{ exercisesText(row.exercises) }}</div>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.sessions.actions')" width="152" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewPlan(row.planId)">{{ t('plans.sessions.viewPlan') }}</el-button>
            <el-popconfirm
              :title="t('plans.sessions.confirmDelete', { date: row.scheduledDate })"
              :width="240"
              confirm-button-type="danger"
              :confirm-button-text="t('common.delete')"
              :cancel-button-text="t('common.cancel')"
              @confirm="removeSession(row)"
            >
              <template #reference
                ><el-button link type="danger">{{ t('common.delete') }}</el-button></template
              >
            </el-popconfirm>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('plans.sessions.empty')" /></template>
      </el-table>
    </div>
    <div class="sessions-pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="pageSizes"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @current-change="loadSessions"
        @size-change="handlePageSizeChange"
      />
    </div>

    <el-dialog
      v-model="deleteDialogVisible"
      :title="t('plans.sessions.batchDeleteTitle')"
      width="min(560px, calc(100vw - 32px))"
      @closed="resetDeleteDialog"
    >
      <div class="session-delete-dialog">
        <p class="session-delete-scope">
          {{
            t(
              deleteScope.mode === 'ids'
                ? 'plans.sessions.batchDeleteScopeSelected'
                : 'plans.sessions.batchDeleteScopeFiltered',
              { count: deleteScope.count }
            )
          }}
        </p>
        <p v-if="deleteScope.mode === 'ids' && selectedDatesText" class="session-delete-conditions">
          {{ t('plans.sessions.conditionDates', { dates: selectedDatesText }) }}
        </p>
        <p v-else-if="deleteScope.mode === 'filter'" class="session-delete-conditions">
          {{ t('plans.sessions.conditionSummary', { conditions: conditionSummary }) }}
        </p>
        <el-alert
          v-if="deleteScope.executionCount > 0"
          class="session-delete-warning"
          type="warning"
          show-icon
          :closable="false"
          :title="t('plans.sessions.batchDeleteHasExecution', { count: deleteScope.executionCount })"
        />
        <p class="session-delete-hint">{{ t('plans.sessions.batchDeleteHint') }}</p>
        <el-checkbox v-model="deleteConfirmed" class="session-delete-confirm">{{
          t('plans.sessions.batchDeleteConfirmLabel', { count: deleteScope.count })
        }}</el-checkbox>
      </div>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button
          type="danger"
          :loading="deleting"
          :disabled="!deleteConfirmed || deleteScope.count === 0"
          @click="confirmDelete"
          >{{ t('common.delete') }}</el-button
        >
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { Delete as DeleteIcon, Refresh, RefreshLeft, Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { useLocaleStore } from '@/stores/localeStore.js';
import { usePlanLabels, SESSION_COMPLETION_STATUSES } from '@/pages/plans/composables/usePlanLabels.js';
import {
  deleteTrainingSession,
  deleteTrainingSessions,
  deleteTrainingSessionsByFilter,
  getTrainingPlans,
  getTrainingSessions
} from '@/api/fitnessApi.js';
import { normalizeRequestError } from '@/utils/requestState.js';
import {
  buildSessionFilterRequest,
  emptySessionFilters,
  hasSessionFilters,
  summarizeSessionFilters
} from '@/utils/sessionFilters.js';

const { t } = useLocaleStore();
const { statusLabel, statusTagType } = usePlanLabels();
const router = useRouter();
const loading = ref(false);
const error = ref('');
const sessions = ref([]);
const plans = ref([]);
const dateRange = ref([]);
const planId = ref('');
const status = ref('');
const logged = ref('');
const search = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const pageSizes = [10, 20, 50];
// 只按完成情况筛选，选项和口径集中放在 usePlanLabels，避免和服务端的推导规则各演化一份。
const sessionStatuses = SESSION_COMPLETION_STATUSES;
const durationParts = ['hours', 'minutes', 'seconds'];

const tableRef = ref(null);
const selectedSessions = ref([]);
const deleteDialogVisible = ref(false);
const deleteConfirmed = ref(false);
const deleting = ref(false);
const previewing = ref(false);
const deleteScope = ref({ mode: 'ids', count: 0, executionCount: 0 });

/**
 * 实际生效的检索条件（最近一次请求的快照）。
 *
 * 批量删除必须和"屏幕上这批行"是同一批，所以删除只认这个快照，不认输入框里还没提交的
 * 关键词——否则用户打了字没回车就点删除，删掉的会是另一批行。
 */
const appliedFilters = ref(emptySessionFilters());
const hasActiveFilters = computed(() => hasSessionFilters(appliedFilters.value));
const selectedCount = computed(() => selectedSessions.value.length);
const selectedIds = computed(() => selectedSessions.value.map((session) => session.id));

const selectedDatesText = computed(() => {
  const dates = [...new Set(selectedSessions.value.map((session) => session.scheduledDate))].sort();
  const shown = dates.slice(0, 6);
  return dates.length > shown.length
    ? `${shown.join(t('common.listSeparator'))} …`
    : shown.join(t('common.listSeparator'));
});

const conditionSummary = computed(() =>
  summarizeSessionFilters(appliedFilters.value, {
    translate: t,
    planName: (id) => plans.value.find((plan) => String(plan.id) === String(id))?.name || ''
  })
);

function currentFilters() {
  return {
    startDate: dateRange.value?.[0] || '',
    endDate: dateRange.value?.[1] || '',
    planId: planId.value || '',
    status: status.value || '',
    logged: logged.value || '',
    search: search.value.trim()
  };
}

/** 空字符串对服务端来说是"这个条件没给"，所以拼请求参数时统一转成 undefined。 */
function requestFilters(filters) {
  return buildSessionFilterRequest(filters);
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

function targetsText(targets) {
  const entries = Object.entries(targets || {}).filter(
    ([metric]) => !['duration', 'durationSeconds', 'durationUnit'].includes(metric)
  );
  const parts = [];
  const seconds = durationSecondsFromTargets(targets || {});
  if (seconds > 0) parts.push(`${metricLabel('duration')} ${formatDurationText(seconds)}`);
  parts.push(...entries.map(([metric, value]) => `${metricLabel(metric)} ${value} ${unitLabel(metric)}`));
  return parts.length > 0 ? parts.join(t('common.listSeparator')) : t('plans.manager.noTargets');
}

function exercisesText(exercises = []) {
  return exercises
    .map((exercise) => `${exercise.name} ${targetsText(exercise.targets)}`)
    .join(t('common.listSeparator'));
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

async function loadSessions() {
  loading.value = true;
  error.value = '';
  appliedFilters.value = currentFilters();
  try {
    const response = await getTrainingSessions({
      ...requestFilters(appliedFilters.value),
      page: currentPage.value,
      pageSize: pageSize.value
    });
    sessions.value = response.sessions;
    total.value = response.total;
  } catch (requestError) {
    error.value = normalizeRequestError(requestError, t) || t('plans.manager.loadFailed');
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  currentPage.value = 1;
  // 换了条件之后上一批勾选已经不在视野里，留着只会让"删除选中"变得不可预期。
  clearSelection();
  loadSessions();
}

function resetFilters() {
  dateRange.value = [];
  planId.value = '';
  status.value = '';
  logged.value = '';
  search.value = '';
  applyFilters();
}

function handlePageSizeChange() {
  currentPage.value = 1;
  loadSessions();
}

function handleSelectionChange(rows) {
  selectedSessions.value = rows;
}

function clearSelection() {
  selectedSessions.value = [];
  tableRef.value?.clearSelection();
}

function viewPlan(id) {
  router.push({ name: 'plans-overview', query: { planId: id } });
}

/** 删掉若干行之后可能停在空页上，先把页码收到最后一页再刷新。 */
function clampPageAfterDelete(deletedCount) {
  const remaining = Math.max(0, total.value - deletedCount);
  const lastPage = Math.max(1, Math.ceil(remaining / pageSize.value));
  if (currentPage.value > lastPage) currentPage.value = lastPage;
}

function openSelectedDeleteDialog() {
  if (selectedCount.value === 0) return;
  deleteScope.value = {
    mode: 'ids',
    count: selectedCount.value,
    // 勾选的行里已经打过卡的条数：这些执行记录会跟着单元一起消失，必须先说清楚。
    executionCount: selectedSessions.value.filter((session) => session.execution).length
  };
  deleteConfirmed.value = false;
  deleteDialogVisible.value = true;
}

async function openFilteredDeleteDialog() {
  if (!hasActiveFilters.value) {
    ElMessage.warning(t('plans.sessions.batchDeleteFilterRequired'));
    return;
  }
  // 打开弹窗时按当前条件重新数一遍：弹窗里的条数必须是服务端现在真的会删掉的条数。
  previewing.value = true;
  try {
    const preview = await getTrainingSessions({ ...requestFilters(appliedFilters.value), page: 1, pageSize: 1 });
    if (preview.total === 0) {
      ElMessage.info(t('plans.sessions.batchDeleteNothing'));
      return;
    }
    deleteScope.value = { mode: 'filter', count: preview.total, executionCount: preview.executionCount ?? 0 };
    deleteConfirmed.value = false;
    deleteDialogVisible.value = true;
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.sessions.batchDeleteFailed'));
  } finally {
    previewing.value = false;
  }
}

async function confirmDelete() {
  if (!deleteConfirmed.value || deleteScope.value.count === 0) return;
  deleting.value = true;
  try {
    const result =
      deleteScope.value.mode === 'filter'
        ? // 把弹窗里给用户看的条数一起带上：服务端求交后对不上就拒绝，不会删掉另一批。
          await deleteTrainingSessionsByFilter(requestFilters(appliedFilters.value), deleteScope.value.count)
        : await deleteTrainingSessions(selectedIds.value);
    const deleted = result.deletedCount ?? result.deletedIds?.length ?? 0;
    ElMessage.success(t('plans.sessions.batchDeleteSuccess', { count: deleted }));
    deleteDialogVisible.value = false;
    clearSelection();
    clampPageAfterDelete(deleted);
    await loadSessions();
  } catch (requestError) {
    ElMessage.error(deleteErrorMessage(requestError));
    // 数量对不上说明列表已经过期：关掉弹窗重新拉一遍，让用户看着新的条数再决定。
    if (requestError.code === 'SESSION_DELETE_COUNT_CHANGED') {
      deleteDialogVisible.value = false;
      clearSelection();
      await loadSessions();
    }
  } finally {
    deleting.value = false;
  }
}

/** 服务端的删除错误码逐条给文案；认不出代码时退回服务端消息。 */
function deleteErrorMessage(requestError) {
  if (requestError.code === 'SESSION_DELETE_COUNT_CHANGED') {
    return t('plans.sessions.batchDeleteCountChanged', { count: requestError.details?.matchedCount ?? 0 });
  }
  const messageKeys = {
    SESSION_DELETE_FILTER_REQUIRED: 'plans.sessions.batchDeleteFilterRequired',
    SESSION_DELETE_COUNT_REQUIRED: 'plans.sessions.batchDeleteCountRequired',
    SESSION_DELETE_TOO_MANY: 'plans.sessions.batchDeleteTooMany',
    SESSION_FILTER_INVALID: 'plans.sessions.batchDeleteFilterInvalid',
    SESSION_DELETE_IDS_INVALID: 'plans.sessions.batchDeleteFailed'
  };
  const messageKey = messageKeys[requestError.code];
  if (messageKey) return t(messageKey);
  return normalizeRequestError(requestError, t) || t('plans.sessions.batchDeleteFailed');
}

async function removeSession(row) {
  try {
    await deleteTrainingSession(row.id);
    ElMessage.success(t('plans.manager.sessionDeleted'));
    clampPageAfterDelete(1);
    await loadSessions();
  } catch (requestError) {
    ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.deleteFailed'));
  }
}

function resetDeleteDialog() {
  deleteConfirmed.value = false;
  deleteScope.value = { mode: 'ids', count: 0, executionCount: 0 };
}

onMounted(async () => {
  try {
    const response = await getTrainingPlans();
    plans.value = response.plans;
  } catch (requestError) {
    error.value = normalizeRequestError(requestError, t) || t('plans.manager.loadFailed');
  }
  await loadSessions();
});
</script>

<style scoped lang="scss">
.sessions-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.sessions-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex: 0 0 auto;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--card-border);
}
h2,
p {
  margin: 0;
}
h2 {
  color: var(--text-primary);
  font-size: 22px;
  letter-spacing: 0;
}
p {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 14px;
}
.sessions-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  flex: 0 0 auto;
  gap: 12px;
  padding: 18px 0;
}
.sessions-toolbar :deep(.el-date-editor.session-date-filter) {
  width: 232px !important;
  flex: 0 0 232px !important;
}
/*
 * 三个下拉按"刚好看得全 placeholder（按完成状态筛选 / 按打卡状态筛选 / 按计划筛选）"来定宽：
 * 7 个汉字约 98px，加上左右内边距和箭头约 44px，156px 留一点余量，再宽就只是白占地方。
 */
.sessions-toolbar :deep(.el-select.session-plan-filter),
.sessions-toolbar :deep(.el-select.session-status-filter),
.sessions-toolbar :deep(.el-select.session-logged-filter) {
  width: 156px;
}
.sessions-toolbar :deep(.el-input.session-search-filter) {
  width: 208px;
}
.sessions-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-left: auto;
}
.sessions-selection {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
  margin: -6px 0 12px;
  color: var(--text-secondary);
  font-size: 13px;
}
.sessions-alert {
  margin-bottom: 14px;
}
.sessions-table-region {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
.sessions-table {
  width: 100%;
  min-width: 900px;
}
.session-date-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.session-logged-tag {
  flex: 0 0 auto;
}
.sessions-pagination {
  display: flex;
  justify-content: flex-end;
  flex: 0 0 auto;
  margin-top: 16px;
  overflow-x: auto;
}
.session-exercises-summary {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-delete-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.session-delete-scope {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 22px;
}
.session-delete-conditions {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 20px;
}
.session-delete-warning {
  align-items: flex-start;
}
.session-delete-hint {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 20px;
}
.session-delete-confirm {
  height: auto;
}
@media (max-width: 640px) {
  .sessions-page {
    height: auto;
    min-height: 360px;
    overflow: visible;
  }
  .sessions-header {
    flex-direction: column;
  }
  .sessions-toolbar :deep(.el-date-editor),
  .sessions-toolbar :deep(.el-select),
  .sessions-toolbar :deep(.el-select.session-status-filter),
  .sessions-toolbar :deep(.el-select.session-logged-filter),
  .sessions-toolbar :deep(.el-select.session-plan-filter),
  .sessions-toolbar :deep(.el-input.session-search-filter) {
    width: 100%;
  }
  .sessions-toolbar :deep(.el-date-editor.session-date-filter) {
    flex: 1 1 100% !important;
  }
  .sessions-toolbar-actions {
    margin-left: 0;
  }
  .sessions-pagination {
    justify-content: flex-start;
  }
  .sessions-table-region {
    flex: none;
    height: 60vh;
    min-height: 360px;
    overflow: auto;
  }
}

:global(.session-content-tooltip) {
  max-width: min(560px, calc(100vw - 32px));
  line-height: 1.6;
}

:global(.session-content-tooltip .session-tooltip-line + .session-tooltip-line) {
  margin-top: 4px;
}
</style>

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
      <el-select v-model="planId" clearable :placeholder="t('plans.sessions.filterPlan')" @change="applyFilters">
        <el-option :label="t('plans.sessions.allPlans')" value="" />
        <el-option v-for="plan in plans" :key="plan.id" :label="plan.name" :value="plan.id" />
      </el-select>
      <el-select v-model="status" clearable :placeholder="t('plans.sessions.filterStatus')" @change="applyFilters">
        <el-option :label="t('plans.sessions.allStatuses')" value="" />
        <el-option
          v-for="sessionStatus in sessionStatuses"
          :key="sessionStatus"
          :label="statusLabel(sessionStatus)"
          :value="sessionStatus"
        />
      </el-select>
    </div>

    <el-alert v-if="error" class="sessions-alert" type="error" :title="error" show-icon :closable="false" />

    <div class="sessions-table-region">
      <el-table v-loading="loading" :data="sessions" height="100%" class="sessions-table">
        <el-table-column :label="t('plans.sessions.date')" width="116">
          <template #default="{ row }"
            ><time :datetime="row.scheduledDate">{{ row.scheduledDate }}</time></template
          >
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
        <el-table-column :label="t('plans.sessions.actions')" width="104" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewPlan(row.planId)">{{ t('plans.sessions.viewPlan') }}</el-button>
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
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { useLocaleStore } from '@/stores/localeStore.js';
import { getTrainingPlans, getTrainingSessions } from '@/api/fitnessApi.js';
import { normalizeRequestError } from '@/utils/requestState.js';

const { t } = useLocaleStore();
const router = useRouter();
const loading = ref(false);
const error = ref('');
const sessions = ref([]);
const plans = ref([]);
const dateRange = ref([]);
const planId = ref('');
const status = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const pageSizes = [10, 20, 50];
const sessionStatuses = ['planned', 'achieved', 'partial', 'no_data', 'unverifiable', 'skipped'];
const durationParts = ['hours', 'minutes', 'seconds'];

function statusLabel(value) {
  return t(`plans.manager.statuses.${value}`);
}

function statusTagType(value) {
  if (['achieved'].includes(value)) return 'success';
  if (['partial'].includes(value)) return 'warning';
  if (['skipped'].includes(value)) return 'danger';
  return 'info';
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
  try {
    const response = await getTrainingSessions({
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
      planId: planId.value || undefined,
      status: status.value || undefined,
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
  loadSessions();
}

function handlePageSizeChange() {
  currentPage.value = 1;
  loadSessions();
}

function viewPlan(id) {
  router.push({ name: 'plans-overview', query: { planId: id } });
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
  flex: 0 0 auto;
  gap: 12px;
  padding: 18px 0;
}
.sessions-toolbar :deep(.el-date-editor.session-date-filter) {
  width: 360px !important;
  flex: 0 0 360px !important;
}
.sessions-toolbar :deep(.el-select) {
  width: 220px;
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
  min-width: 670px;
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
  .sessions-toolbar :deep(.el-select) {
    width: 100%;
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

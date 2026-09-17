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
        type="daterange"
        value-format="YYYY-MM-DD"
        :start-placeholder="t('nav.startDate')"
        :end-placeholder="t('nav.endDate')"
        :aria-label="t('plans.sessions.filterDate')"
        @change="loadSessions"
      />
      <el-select v-model="planId" clearable :placeholder="t('plans.sessions.filterPlan')" @change="loadSessions">
        <el-option :label="t('plans.sessions.allPlans')" value="" />
        <el-option v-for="plan in plans" :key="plan.id" :label="plan.name" :value="plan.id" />
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
        <el-table-column :label="t('plans.sessions.name')" min-width="160">
          <template #default="{ row }">
            <span class="session-name">{{ row.name || t('plans.sessions.title') }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.sessions.plan')" min-width="150" prop="planName" />
        <el-table-column :label="t('plans.sessions.phase')" min-width="130" prop="phaseName" />
        <el-table-column :label="t('plans.sessions.exercises')" min-width="220">
          <template #default="{ row }">
            <div class="session-exercises">
              <span v-for="exercise in row.exercises" :key="exercise.name">{{ exercise.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.sessions.status')" width="108">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
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

function statusLabel(status) {
  return t(`plans.manager.statuses.${status}`);
}

function statusTagType(status) {
  if (['achieved'].includes(status)) return 'success';
  if (['partial'].includes(status)) return 'warning';
  if (['skipped'].includes(status)) return 'danger';
  return 'info';
}

async function loadSessions() {
  loading.value = true;
  error.value = '';
  try {
    const response = await getTrainingSessions({
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
      planId: planId.value || undefined
    });
    sessions.value = response.sessions;
  } catch (requestError) {
    error.value = normalizeRequestError(requestError, t) || t('plans.manager.loadFailed');
  } finally {
    loading.value = false;
  }
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
  min-height: 100%;
}
.sessions-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
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
  gap: 12px;
  padding: 18px 0;
}
.sessions-toolbar :deep(.el-select) {
  width: 220px;
}
.sessions-alert {
  margin-bottom: 14px;
}
.sessions-table-region {
  flex: 1;
  min-height: 340px;
  overflow: auto;
}
.sessions-table {
  min-width: 800px;
}
.session-name {
  color: var(--text-primary);
  font-weight: 600;
}
.session-exercises {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.session-exercises span {
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--text-secondary);
  background: var(--app-bg);
  font-size: 12px;
}
@media (max-width: 640px) {
  .sessions-header {
    flex-direction: column;
  }
  .sessions-toolbar :deep(.el-date-editor),
  .sessions-toolbar :deep(.el-select) {
    width: 100%;
  }
}
</style>

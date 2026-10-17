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

    <PlanListTable
      v-model:archived-filter="archivedFilter"
      :plans="plans"
      :selected-plan-id="selectedPlanId"
      @select="selectPlan"
      @remove="removePlan"
    />

    <PlanDetailDrawer
      v-model="detailDrawerVisible"
      :plan="planDetail"
      :loading="detailLoading"
      :archiving="archivingPlan"
      :weight-data="planWeightData"
      @edit="openPlanDialog"
      @toggle-archive="togglePlanArchived"
      @remove="removePlan"
      @add-sessions="openBatchSessionDialog"
      @add-review="openPlanReviewDialog"
      @edit-session="openSessionDialog($event.session, $event.scheduledDate)"
      @remove-session="removeSession"
      @backfill="openMobileBackfill"
    />

    <PlanFormDialog
      v-model="planDialogVisible"
      :plan="editingPlan"
      :exercises="exercises"
      :saving="saving"
      @submit="savePlanRequest"
    />

    <SessionFormDialog
      v-model="sessionDialogVisible"
      :session="sessionDialogSession"
      :scheduled-date="sessionDialogDate"
      :default-date="planDetail?.startDate || ''"
      :exercises="exercises"
      :saving="saving"
      @submit="saveSession"
    />

    <BatchSessionDialog
      v-model="batchSessionDialogVisible"
      :plan="planDetail"
      :exercises="exercises"
      :saving="saving"
      @submit="saveBatchSessions"
    />

    <PhaseReviewDialog
      v-model="phaseReviewDialogVisible"
      :phase="reviewPhase"
      :plan-name="planDetail?.name || ''"
      :saving="saving"
      @submit="savePhaseReview"
    />
  </section>
</template>

<script setup>
import { Plus } from '@element-plus/icons-vue';
import BatchSessionDialog from '@/pages/plans/components/BatchSessionDialog.vue';
import PhaseReviewDialog from '@/pages/plans/components/PhaseReviewDialog.vue';
import PlanDetailDrawer from '@/pages/plans/components/PlanDetailDrawer.vue';
import PlanFormDialog from '@/pages/plans/components/PlanFormDialog.vue';
import PlanListTable from '@/pages/plans/components/PlanListTable.vue';
import SessionFormDialog from '@/pages/plans/components/SessionFormDialog.vue';
import { usePlanWorkspace } from '@/pages/plans/composables/usePlanWorkspace.js';
import { useLocaleStore } from '@/stores/localeStore.js';

const { t } = useLocaleStore();
const {
  archivingPlan,
  batchSessionDialogVisible,
  detailDrawerVisible,
  detailLoading,
  editingPlan,
  error,
  exercises,
  loading,
  phaseReviewDialogVisible,
  planDialogVisible,
  planDetail,
  planWeightData,
  plans,
  reviewPhase,
  saving,
  selectedPlanId,
  sessionDialogDate,
  sessionDialogSession,
  sessionDialogVisible,
  archivedFilter,
  openBatchSessionDialog,
  openMobileBackfill,
  openPlanDialog,
  openPlanReviewDialog,
  openSessionDialog,
  removePlan,
  removeSession,
  saveBatchSessions,
  savePhaseReview,
  savePlanRequest,
  saveSession,
  selectPlan,
  togglePlanArchived
} = usePlanWorkspace();
</script>

<style scoped lang="scss">
.plan-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.plan-content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
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

.plan-content-header p {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}

.plan-alert {
  flex: 0 0 auto;
  margin-top: 16px;
}

@media (max-width: 640px) {
  .plan-manager {
    height: auto;
    min-height: 360px;
    overflow: visible;
  }

  .plan-content-header {
    flex-direction: column;
  }

  .plan-content-header > .el-button {
    width: 100%;
  }
}
</style>

<template>
  <el-drawer
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    class="plan-detail-drawer"
    size="min(1280px, 96vw)"
    :with-header="false"
    destroy-on-close
  >
    <main v-loading="loading" class="plan-detail">
      <template v-if="plan">
        <header class="plan-detail-header">
          <div class="plan-detail-title">
            <div class="plan-detail-title__line">
              <h3>{{ planTitle }}</h3>
              <el-tag :type="lifecycleTagType(plan.lifecycle)">{{ lifecycleLabel(plan.lifecycle) }}</el-tag>
              <el-tag v-if="plan.archived" type="info" effect="plain">
                {{ t('plans.manager.archived') }}
              </el-tag>
            </div>
            <p v-if="!plan.goal">{{ plan.startDate }} - {{ plan.endDate }}</p>
          </div>
          <div class="plan-detail-actions">
            <el-button :icon="EditPen" @click="emit('edit', plan)">{{ t('common.edit') }}</el-button>
            <el-button
              type="primary"
              plain
              :icon="plan.archived ? RefreshLeft : Box"
              :loading="archiving"
              @click="emit('toggle-archive', plan)"
            >
              {{ plan.archived ? t('plans.manager.unarchive') : t('plans.manager.archive') }}
            </el-button>
            <el-button type="primary" :icon="Plus" @click="emit('add-sessions')">{{
              t('plans.manager.addSession')
            }}</el-button>
            <el-popconfirm
              :title="t('plans.manager.confirmDeletePlan', { name: plan.name })"
              :width="360"
              confirm-button-type="danger"
              :confirm-button-text="t('common.delete')"
              :cancel-button-text="t('common.cancel')"
              @confirm="emit('remove', plan)"
            >
              <template #reference>
                <el-button type="danger" plain :icon="Delete">{{ t('common.delete') }}</el-button>
              </template>
            </el-popconfirm>
          </div>
          <div v-if="plan.goal" class="plan-goal">
            <div class="plan-goal__content">
              <div class="plan-goal__heading">
                <span>{{ t('plans.manager.planGoal') }}</span>
                <span class="plan-goal__period">{{ plan.startDate }} - {{ plan.endDate }}</span>
              </div>
              <p>{{ plan.goal }}</p>
            </div>
          </div>
        </header>

        <el-tabs v-model="planTab" class="plan-detail-tabs">
          <el-tab-pane name="calendar">
            <template #label>
              <span class="plan-tab-label">{{ t('plans.manager.calendarTitle') }}</span>
            </template>
            <PlanCalendarTab
              :plan="plan"
              @edit-session="emit('edit-session', $event)"
              @remove-session="emit('remove-session', $event)"
              @backfill="emit('backfill', $event)"
            />
          </el-tab-pane>
          <el-tab-pane name="review">
            <template #label>
              <span class="plan-tab-label">
                {{ t('plans.manager.phaseReviews') }}
                <el-tag size="small" effect="plain" :type="reviewPhase?.review ? 'success' : 'info'">
                  {{
                    reviewPhase?.review ? t('plans.manager.reviewStatusFilled') : t('plans.manager.reviewStatusPending')
                  }}
                </el-tag>
              </span>
            </template>
            <PlanReviewTab :plan="plan" :weight-data="weightData" @edit-review="emit('add-review', $event)" />
          </el-tab-pane>
        </el-tabs>
      </template>
    </main>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { Box, Delete, EditPen, Plus, RefreshLeft } from '@element-plus/icons-vue';
import PlanCalendarTab from '@/pages/plans/components/PlanCalendarTab.vue';
import PlanReviewTab from '@/pages/plans/components/PlanReviewTab.vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import { usePlanLabels } from '@/pages/plans/composables/usePlanLabels.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 计划详情；为 null 时抽屉内容整体不渲染。 */
  plan: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  archiving: { type: Boolean, default: false },
  weightData: { type: Object, default: null }
});
const emit = defineEmits([
  'update:modelValue',
  'edit',
  'toggle-archive',
  'remove',
  'add-sessions',
  'add-review',
  // 训练单元的三个动作由日历页签冒泡上来，抽屉只做转发。
  'edit-session',
  'remove-session',
  'backfill'
]);

const { t } = useLocaleStore();
const { lifecycleLabel, lifecycleTagType } = usePlanLabels();

const planTab = ref('calendar');
const reviewPhase = ref(null);
const primaryPhase = computed(() => props.plan?.phases?.[0] || null);
// 阶段名称直接跟在计划标题后面，用括号附注，不再单独占一行、也不重复状态标签。
const planTitle = computed(() => {
  const name = props.plan?.name || '';
  const phaseName = primaryPhase.value?.name;
  return phaseName ? `${name}${t('plans.manager.phaseInline', { name: phaseName })}` : name;
});

// 换计划时回到训练日历页签；同一个计划重新拉取（例如刚保存训练单元）不打断当前页签。
watch(
  () => props.plan?.id,
  (id) => {
    if (id) planTab.value = 'calendar';
  }
);

// 计划反馈页签的状态标签和「填写反馈」按钮都以同一个阶段为准，详情重新拉取后也要跟着更新。
watch(
  () => props.plan,
  (plan) => {
    const phases = plan?.phases || [];
    reviewPhase.value = phases.find((phase) => phase.review) || phases[0] || null;
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.plan-detail-drawer :deep(.el-drawer__body) {
  padding: 0;
}

.plan-detail {
  min-width: 0;
  overflow: auto;
  padding: 20px;
}

h3,
p {
  margin: 0;
}

.plan-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--card-border);
}

.plan-detail-title__line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plan-detail-title h3 {
  color: var(--text-primary);
  font-size: 20px;
  letter-spacing: 0;
}

.plan-detail-title > p {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
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

.plan-detail-actions {
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

@media (max-width: 640px) {
  .plan-detail-header {
    flex-direction: column;
  }

  .plan-detail-actions {
    width: 100%;
  }

  .plan-detail-actions > .el-button {
    flex: 1;
  }
}
</style>

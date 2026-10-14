<template>
  <div class="plan-table-region" :aria-label="t('plans.title')">
    <div class="plan-table-toolbar">
      <el-checkbox
        :model-value="showArchived"
        @update:model-value="emit('update:showArchived', $event)"
        class="plan-archived-toggle"
        >{{ t('plans.manager.showArchived') }}</el-checkbox
      >
    </div>
    <el-table
      :data="plans"
      height="100%"
      class="plan-table"
      :row-class-name="({ row }) => (row.id === selectedPlanId ? 'is-selected' : '')"
      @row-click="(row) => emit('select', row.id)"
    >
      <el-table-column :label="t('plans.manager.planName')" min-width="200">
        <template #default="{ row }">
          <div class="plan-cell">
            <div class="plan-cell-name" :class="planProgressClass(row)">
              {{ row.name }}-{{ row.phaseName || t('plans.manager.noPhase') }}
            </div>
            <!-- 数据覆盖率放在列表里，不用打开计划详情也能看出这两天到底有没有手表数据 -->
            <small v-if="row.coverage?.verifiableItems" class="plan-cell-coverage">
              {{ t('plans.manager.coverageRate') }} {{ formatRate(row.coverage.coverageRate) }}
            </small>
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
      <el-table-column :label="t('plans.manager.lifecycle')" width="120">
        <template #default="{ row }">
          <div class="plan-lifecycle-cell">
            <el-tag size="small" :type="lifecycleTagType(row.lifecycle)">{{ lifecycleLabel(row.lifecycle) }}</el-tag>
            <el-tag v-if="row.archived" size="small" type="info" effect="plain">
              {{ t('plans.manager.archived') }}
            </el-tag>
          </div>
        </template>
      </el-table-column>
      <!-- 达成度用「比率 + 分数」两个口径一起显示：只给百分比时，四舍五入后的数字
             会和档位区间看起来矛盾（例如 74.6% 显示成 75% 却仍是「略有缺口」）。 -->
      <el-table-column :label="t('plans.manager.adherence.title')" width="180">
        <template #default="{ row }">
          <div class="plan-adherence-cell">
            <el-tooltip :content="adherenceTooltip(row)" placement="top" :disabled="!adherenceTooltip(row)">
              <span class="plan-adherence-cell__rate">{{ adherenceRateText(row) }}</span>
            </el-tooltip>
            <small v-if="adherenceDetailText(row)" class="plan-adherence-cell__detail">
              {{ adherenceDetailText(row) }}
            </small>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('plans.sessions.title')" width="104" align="center" prop="sessionCount" />
      <el-table-column :label="t('plans.sessions.actions')" width="152" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="emit('select', row.id)">{{
            t('plans.sessions.viewPlan')
          }}</el-button>
          <el-popconfirm
            :title="t('plans.manager.confirmDeletePlan', { name: row.name })"
            :width="360"
            confirm-button-type="danger"
            :confirm-button-text="t('common.delete')"
            :cancel-button-text="t('common.cancel')"
            @confirm="emit('remove', row)"
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
</template>

<script setup>
import { useLocaleStore } from '@/stores/localeStore.js';
import { usePlanLabels } from '@/pages/plans/composables/usePlanLabels.js';
import { usePlanProgress } from '@/pages/plans/composables/usePlanProgress.js';

defineProps({
  plans: { type: Array, default: () => [] },
  selectedPlanId: { type: [Number, String], default: null },
  showArchived: { type: Boolean, default: false }
});
const emit = defineEmits(['select', 'remove', 'update:showArchived']);

const { t } = useLocaleStore();
const { lifecycleLabel, lifecycleTagType } = usePlanLabels();
const { adherenceDetailText, adherenceRateText, adherenceTooltip, formatRate, planProgressClass } = usePlanProgress();
</script>

<style scoped lang="scss">
.plan-table-region {
  flex: 1;
  min-height: 380px;
  margin-top: 20px;
  overflow: auto;
}

.plan-table-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.plan-archived-toggle {
  height: auto;
  font-size: 13px;
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

.plan-cell {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.plan-cell-name {
  color: var(--text-primary);
  font-weight: 600;
  overflow-wrap: anywhere;
}

/* 生命周期只影响名称的强调程度：已归档最淡，进行中正常，结束且没练过任何一天标红。 */
.plan-cell-name--archived {
  color: var(--text-secondary);
  font-weight: 500;
}

.plan-cell-name--active {
  color: var(--primary-color);
}

.plan-cell-name--completed {
  color: var(--text-primary);
}

.plan-cell-name--incomplete {
  color: var(--danger-color, #f56c6c);
}

.plan-lifecycle-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.plan-adherence-cell {
  display: grid;
  gap: 2px;
}

.plan-adherence-cell__rate {
  color: var(--text-primary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.plan-adherence-cell__detail {
  color: var(--text-secondary);
  font-size: 12px;
}

.plan-cell-coverage {
  color: var(--text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
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

@media (max-width: 900px) {
  .plan-table-region {
    overflow: auto;
  }
}
</style>

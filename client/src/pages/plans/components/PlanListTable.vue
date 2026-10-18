<template>
  <div class="plan-table-region" :aria-label="t('plans.title')">
    <div class="plan-toolbar">
      <div class="plan-filters">
        <el-input
          v-model="searchDraft"
          class="plan-search-filter"
          clearable
          maxlength="60"
          :placeholder="t('plans.manager.filterSearch')"
          :aria-label="t('plans.manager.filterSearch')"
          @keyup.enter="applyFilters"
          @clear="applyFilters"
        />
        <el-date-picker
          v-model="dateRange"
          class="plan-date-filter"
          type="daterange"
          value-format="YYYY-MM-DD"
          :start-placeholder="t('nav.startDate')"
          :end-placeholder="t('nav.endDate')"
          :aria-label="t('plans.manager.filterPeriod')"
          @change="handleFilterChange"
        />
        <el-select
          v-model="lifecycle"
          class="plan-lifecycle-filter"
          clearable
          :placeholder="t('plans.manager.filterLifecycle')"
          @change="handleFilterChange"
        >
          <el-option v-for="value in lifecycles" :key="value" :label="lifecycleLabel(value)" :value="value" />
        </el-select>
        <el-select
          :model-value="archivedFilter"
          class="plan-archived-filter"
          :placeholder="t('plans.manager.filterArchived')"
          @change="changeArchivedFilter"
        >
          <el-option :label="t('plans.manager.archiveOptions.unarchived')" value="unarchived" />
          <el-option :label="t('plans.manager.archiveOptions.all')" value="all" />
          <el-option :label="t('plans.manager.archiveOptions.archived')" value="archived" />
        </el-select>
      </div>
      <div class="plan-toolbar-actions">
        <el-button :icon="Search" @click="applyFilters">{{ t('common.query') }}</el-button>
        <el-button :icon="RefreshLeft" @click="resetFilters">{{ t('common.reset') }}</el-button>
      </div>
    </div>

    <div class="plan-table-body">
      <el-table
        :data="pagedPlans"
        height="100%"
        class="plan-table"
        :default-sort="{ prop: 'startDate', order: 'descending' }"
        :row-class-name="({ row }) => (row.id === selectedPlanId ? 'is-selected' : '')"
        @row-click="(row) => emit('select', row.id)"
        @sort-change="handleSortChange"
      >
        <el-table-column :label="t('plans.manager.planName')" min-width="210">
          <template #default="{ row }">
            <div class="plan-cell">
              <div class="plan-cell-name" :class="planProgressClass(row)" :title="planTitle(row)">
                {{ planTitle(row) }}
              </div>
              <small v-if="row.coverage?.verifiableItems" class="plan-cell-coverage">
                {{ t('plans.manager.coverageRate') }} {{ formatRate(row.coverage.coverageRate) }}
              </small>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.manager.planGoal')" min-width="130">
          <template #default="{ row }">
            <span class="plan-cell-goal" :title="row.goal || ''">{{ row.goal || t('common.empty') }}</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('plans.manager.planPeriod')"
          width="175"
          prop="startDate"
          sortable="custom"
          :sort-orders="['descending', 'ascending']"
        >
          <template #header>
            <el-tooltip :content="sortTooltip" placement="top">
              <span>{{ t('plans.manager.planPeriod') }}</span>
            </el-tooltip>
          </template>
          <template #default="{ row }">
            <span class="plan-period">{{ row.startDate }} - {{ row.endDate }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.manager.lifecycle')" width="100">
          <template #default="{ row }">
            <div class="plan-lifecycle-cell">
              <el-tag
                size="small"
                :type="row.archived ? 'info' : lifecycleTagType(row.lifecycle)"
                :effect="row.archived ? 'plain' : 'light'"
                >{{ lifecycleLabel(row.lifecycle) }}</el-tag
              >
              <el-tag v-if="row.archived" size="small" type="info" effect="plain">
                {{ t('plans.manager.archived') }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <!-- 达成度用「比率 + 分数」两个口径一起显示：只给百分比时，四舍五入后的数字
               会和档位区间看起来矛盾（例如 74.6% 显示成 75% 却仍是「略有缺口」）。 -->
        <el-table-column :label="t('plans.manager.adherence.title')" width="155">
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
        <el-table-column :label="t('plans.sessions.title')" width="92" align="center" prop="sessionCount" />
        <el-table-column :label="t('plans.sessions.actions')" width="140" fixed="right">
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

    <div class="plan-pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="pageSizes"
        :total="total"
        layout="total, sizes, prev, pager, next"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { RefreshLeft, Search } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import { usePlanLabels } from '@/pages/plans/composables/usePlanLabels.js';
import { usePlanProgress } from '@/pages/plans/composables/usePlanProgress.js';

const props = defineProps({
  plans: { type: Array, default: () => [] },
  selectedPlanId: { type: [Number, String], default: null },
  archivedFilter: { type: String, default: 'unarchived' }
});
const emit = defineEmits(['select', 'remove', 'update:archivedFilter']);

const { t } = useLocaleStore();
const { lifecycleLabel, lifecycleTagType } = usePlanLabels();
const { adherenceDetailText, adherenceRateText, adherenceTooltip, formatRate, planProgressClass } = usePlanProgress();

const lifecycles = ['draft', 'active', 'ended'];
const pageSizes = [10, 20, 50];

const searchDraft = ref('');
const appliedSearch = ref('');
const dateRange = ref([]);
const lifecycle = ref('');
const sortOrder = ref('desc');
const currentPage = ref(1);
const pageSize = ref(pageSizes[0]);

// 计划列表本来就一次性返回，筛选和翻页都放在前端做，避免为一个轻量列表再写一套接口参数。
const filteredPlans = computed(() => {
  const keyword = appliedSearch.value.trim().toLowerCase();
  return props.plans
    .filter((plan) => {
      if (props.archivedFilter === 'unarchived' && plan.archived) return false;
      if (props.archivedFilter === 'archived' && !plan.archived) return false;
      if (lifecycle.value && plan.lifecycle !== lifecycle.value) return false;
      if (dateRange.value?.length === 2) {
        const [from, to] = dateRange.value;
        // 与所选区间有交集就算命中：只看计划完整落在区间内会漏掉跨月计划。
        if (plan.endDate < from || plan.startDate > to) return false;
      }
      if (!keyword) return true;
      return [plan.name, plan.goal, plan.phaseName]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(keyword));
    })
    .sort((left, right) => {
      // 按计划周期的开始日期排；同一天再按 id 保证顺序稳定。
      const direction = sortOrder.value === 'asc' ? 1 : -1;
      if (left.startDate !== right.startDate) {
        return left.startDate < right.startDate ? -direction : direction;
      }
      return (left.id - right.id) * direction;
    });
});

const total = computed(() => filteredPlans.value.length);

// 表头排序没有文字提示，用 tooltip 把"当前方向 + 点击后会切到哪一档"说清楚。
const sortTooltip = computed(() =>
  sortOrder.value === 'asc' ? t('plans.manager.sortTooltipAsc') : t('plans.manager.sortTooltipDesc')
);

const pagedPlans = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredPlans.value.slice(start, start + pageSize.value);
});

watch([appliedSearch, dateRange, lifecycle], () => {
  currentPage.value = 1;
});

watch([pageSize, total], () => {
  const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

/** 阶段名称和计划详情一致：用括号附在计划名后面，不再单独占一行。 */
function planTitle(row) {
  return row.phaseName ? `${row.name}${t('plans.manager.phaseInline', { name: row.phaseName })}` : row.name;
}

function applyFilters() {
  appliedSearch.value = searchDraft.value;
  currentPage.value = 1;
}

function handleFilterChange() {
  currentPage.value = 1;
}

/** 表头排序只认计划周期的开始日期；两档切换，不提供"取消排序"。 */
function handleSortChange({ prop, order }) {
  if (prop !== 'startDate' || !order) return;
  sortOrder.value = order === 'ascending' ? 'asc' : 'desc';
  currentPage.value = 1;
}

function resetFilters() {
  searchDraft.value = '';
  appliedSearch.value = '';
  dateRange.value = [];
  lifecycle.value = '';
  if (props.archivedFilter !== 'unarchived') emit('update:archivedFilter', 'unarchived');
  currentPage.value = 1;
}

function changeArchivedFilter(value) {
  emit('update:archivedFilter', value);
  currentPage.value = 1;
}
</script>

<style scoped lang="scss">
.plan-table-region {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.plan-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  flex: 0 0 auto;
  gap: 10px;
  padding: 18px 0;
}

.plan-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  flex: 1 1 560px;
  min-width: 0;
  gap: 10px;
}

.plan-toolbar :deep(.el-input.plan-search-filter) {
  width: 200px;
}

.plan-toolbar :deep(.el-date-editor.plan-date-filter) {
  width: 224px !important;
  flex: 0 0 224px !important;
}

.plan-toolbar :deep(.el-select.plan-lifecycle-filter),
.plan-toolbar :deep(.el-select.plan-archived-filter) {
  width: 156px;
}

.plan-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  flex: 0 0 auto;
  gap: 10px;
  margin-left: auto;
}

.plan-table-body {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.plan-table {
  width: 100%;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-cell-coverage {
  color: var(--text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
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

.plan-period {
  color: var(--text-secondary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.plan-cell-goal {
  display: block;
  overflow: hidden;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-pagination {
  display: flex;
  justify-content: flex-end;
  flex: 0 0 auto;
  margin-top: 16px;
  overflow-x: auto;
}

@media (max-width: 640px) {
  .plan-table-region {
    flex: none;
  }

  .plan-table-body {
    flex: none;
    height: 60vh;
    min-height: 360px;
    overflow: auto;
  }

  .plan-toolbar :deep(.el-input.plan-search-filter),
  .plan-toolbar :deep(.el-select.plan-lifecycle-filter),
  .plan-toolbar :deep(.el-select.plan-archived-filter) {
    width: 100%;
  }

  .plan-toolbar :deep(.el-date-editor.plan-date-filter) {
    width: 100% !important;
    flex: 1 1 100% !important;
  }

  .plan-filters,
  .plan-toolbar-actions {
    flex: 1 1 100%;
  }

  .plan-toolbar-actions {
    margin-left: 0;
  }

  .plan-pagination {
    justify-content: flex-start;
  }
}
</style>

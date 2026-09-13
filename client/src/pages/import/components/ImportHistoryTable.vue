<template>
  <el-table
    v-if="!loading && !error"
    :data="history"
    class="history-table"
    height="100%"
    stripe
    @selection-change="$emit('selection-change', $event)"
  >
    <el-table-column type="selection" width="48" />
    <el-table-column prop="createdAt" :label="t('import.createdAt')" width="210">
      <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
    </el-table-column>
    <el-table-column prop="fileName" :label="t('import.fileName')" min-width="360" show-overflow-tooltip />
    <el-table-column prop="platformLabel" :label="t('import.platform')" width="170">
      <template #default="{ row }">
        <el-tag effect="light" type="primary">{{ row.platformLabel || platformLabel(row.platform) }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="fileSize" :label="t('import.fileSize')" width="130">
      <template #default="{ row }">{{ formatSize(row.fileSize) }}</template>
    </el-table-column>
    <el-table-column prop="overview" :label="t('import.overview')" min-width="300" show-overflow-tooltip>
      <template #default="{ row }">{{ row.overview || overviewFromResult(row) }}</template>
    </el-table-column>
    <el-table-column prop="status" :label="t('import.status')" width="130">
      <template #default="{ row }">
        <el-tag :type="statusMeta(row.status).type" effect="light">
          {{ statusMeta(row.status).label }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column :label="t('import.actions')" width="260" fixed="right">
      <template #default="{ row }">
        <div class="row-actions">
          <el-button class="action-link view-link" type="primary" link :icon="View" @click="$emit('view', row)">
            {{ t('common.view') }}
          </el-button>
          <el-button class="action-link delete-link" type="danger" link :icon="Delete" @click="$emit('delete', row.importId || row.id)">
            {{ t('common.delete') }}
          </el-button>
          <el-button
            v-if="canImport(row)"
            type="success"
            link
            class="action-link import-link"
            :icon="Upload"
            :loading="activeImportId === row.importId"
            @click="$emit('commit', row.importId)"
          >
            {{ t('import.parse') }}
          </el-button>
        </div>
      </template>
    </el-table-column>
    <template #empty>
      <AsyncState class="history-empty-state" empty :empty-description="t('import.noHistory')" />
    </template>
  </el-table>
  <AsyncState
    v-else
    class="history-state"
    :loading="loading"
    :error="error"
    :show-retry="Boolean(error)"
    @retry="$emit('retry')"
  />
</template>

<script setup>
import { ElButton, ElTable, ElTableColumn, ElTag } from 'element-plus';
import { Delete, Upload, View } from '@element-plus/icons-vue';
import AsyncState from '@/components/common/AsyncState.vue';
import { formatDateTime as formatLocalizedDateTime, formatNumber } from '@/i18n/index.js';
import { useLocaleStore } from '@/stores/localeStore.js';

defineProps({
  history: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  activeImportId: {
    type: [String, Number],
    default: ''
  }
});

defineEmits(['selection-change', 'view', 'delete', 'commit', 'retry']);

const { t } = useLocaleStore();

function platformLabel(value) {
  return value === 'huawei' ? t('import.huawei') : t('import.xiaomi');
}

function statusMeta(status) {
  return {
    pending: { label: t('import.statusPending'), type: 'warning' },
    queued: { label: t('import.statusPending'), type: 'warning' },
    partial: { label: t('import.statusPartial'), type: 'warning' },
    success: { label: t('import.statusSuccess'), type: 'success' },
    completed: { label: t('import.statusCompleted'), type: 'success' },
    failed: { label: t('import.statusFailed'), type: 'danger' }
  }[status] || { label: status || t('common.unknown'), type: 'info' };
}

function canImport(row) {
  return Boolean(row?.importId && ['pending', 'queued', 'success', 'partial'].includes(row.status));
}

function formatDateTime(value) {
  return value ? formatLocalizedDateTime(value) : '--';
}

function formatSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value)) return '--';
  if (value < 1024) return `${formatNumber(value)} B`;
  if (value < 1024 * 1024) return `${formatNumber(value / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB`;
  return `${formatNumber(value / 1024 / 1024, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
}

function overviewFromResult(row) {
  const result = row.result || {};
  return result.overview || result.message || '--';
}
</script>

<style scoped lang="scss">
.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-link {
  font-size: 16px;
  font-weight: 700;
}

.view-link {
  color: #409eff;
}

.delete-link {
  color: #f56c6c;
}

.import-link {
  color: #67c23a;
}

.history-table {
  flex: 1;
  --el-table-header-bg-color: #ffffff;
  --el-table-header-text-color: #909399;
  --el-table-border-color: #ebeef5;
  --el-table-row-hover-bg-color: #f7fbff;
  color: #606266;
  font-size: 16px;
}

.history-table :deep(.el-table__header th) {
  height: 62px;
  font-weight: 700;
  font-size: 16px;
  background: #ffffff;
  border-bottom: 1px solid #ebeef5;
}

.history-table :deep(.el-table__row) {
  height: 64px;
}

.history-table :deep(.el-table__cell) {
  padding: 0;
}

.history-table :deep(.cell) {
  line-height: 24px;
}

.history-table :deep(.el-checkbox__inner) {
  width: 18px;
  height: 18px;
  border-color: #dcdfe6;
  border-radius: 3px;
}

.history-table :deep(.el-tag) {
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 600;
}

.history-state,
.history-empty-state {
  min-height: 240px;
}

.history-state {
  flex: 1;
}
</style>

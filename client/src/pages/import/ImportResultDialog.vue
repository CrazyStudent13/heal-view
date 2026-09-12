<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('import.healthData')"
    width="70vw"
    top="4vh"
    class="import-result-dialog"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-if="result" class="result-panel">
      <div :class="['result-head', result.status]">
        <el-icon class="result-icon">
          <CircleCheckFilled v-if="['success', 'completed'].includes(result.status)" />
          <WarningFilled v-else-if="result.status === 'partial'" />
          <CircleCloseFilled v-else />
        </el-icon>
        <div>
          <h3>{{ result.title }}</h3>
          <p>{{ result.message }}</p>
        </div>
      </div>

      <div class="result-meta">
        <span>{{ t('import.platformValue', { value: result.platformLabel || '--' }) }}</span>
        <span>{{ result.fileName || '--' }}</span>
        <span>{{ t('import.archiveSizeValue', { value: result.fileSizeText || '--' }) }}</span>
      </div>

      <el-alert
        v-if="result.reasons?.length"
        class="result-alert"
        :title="result.status === 'failed' ? t('import.parseFailed') : t('import.partialFailure')"
        type="warning"
        show-icon
        :closable="false"
      >
        <ul class="reason-list">
          <li v-for="reason in result.reasons" :key="reason">{{ reason }}</li>
        </ul>
      </el-alert>

      <div v-if="result.previewItems?.length" class="preview-block">
        <div class="block-title">{{ t('import.previewTitle') }}</div>
        <el-table :data="result.previewItems" size="small" height="100%">
          <el-table-column prop="date" :label="t('import.dateRange')" width="190" show-overflow-tooltip />
          <el-table-column prop="category" :label="t('import.dataItem')" width="130" show-overflow-tooltip />
          <el-table-column prop="value" :label="t('import.parseSummary')" min-width="320" show-overflow-tooltip />
          <el-table-column prop="target" :label="t('import.writeTarget')" width="190" show-overflow-tooltip />
          <el-table-column prop="source" :label="t('import.sourceFile')" min-width="320" show-overflow-tooltip />
        </el-table>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">{{ t('common.close') }}</el-button>
      <el-button v-if="result?.status === 'completed'" type="primary" @click="$emit('view-dashboard')">
        {{ t('import.viewDashboard') }}
      </el-button>
      <el-button
        v-else-if="result?.importId && result?.status !== 'failed'"
        type="primary"
        :loading="activeImportId === result.importId"
        @click="$emit('commit', result.importId)"
      >
        {{ t('import.commitToDatabase') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ElAlert, ElButton, ElDialog, ElIcon, ElTable, ElTableColumn } from 'element-plus';
import { CircleCheckFilled, CircleCloseFilled, WarningFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';

defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  result: {
    type: Object,
    default: null
  },
  activeImportId: {
    type: [String, Number],
    default: ''
  }
});

defineEmits(['update:modelValue', 'view-dashboard', 'commit']);

const { t } = useLocaleStore();
</script>

<style scoped lang="scss">
.result-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 0;
  text-align: left;
}

.result-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 8px;
  background: #ecf5ff;
}

.result-head.completed,
.result-head.success {
  background: #f2fbef;
  border: 1px solid #c9efbf;
}

.result-head.partial {
  background: rgba(230, 162, 60, 0.14);
}

.result-head.failed {
  background: rgba(245, 108, 108, 0.12);
}

.result-icon {
  font-size: 26px;
  flex-shrink: 0;
}

.result-head.completed .result-icon,
.result-head.success .result-icon {
  color: #67c23a;
}

.result-head.partial .result-icon {
  color: #e6a23c;
}

.result-head.failed .result-icon {
  color: #f56c6c;
}

.result-head h3 {
  margin: 0;
  color: #303133;
  font-size: 18px;
  line-height: 1.25;
  font-weight: 700;
}

.result-head p {
  margin: 2px 0 0;
  color: #909399;
  font-size: 13px;
  line-height: 1.35;
}

.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 6px 0;
  color: #909399;
  font-size: 14px;
  font-weight: 600;
}

.result-meta span {
  padding: 0;
  border-radius: 0;
  background: transparent;
}

.reason-list {
  margin: 8px 0 0;
  padding-left: 18px;
}

.preview-block {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  margin-top: 6px;
}

.block-title {
  margin-bottom: 6px;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.preview-block :deep(.el-table) {
  flex: 1;
  min-height: 0;
  color: #606266;
  font-size: 14px;
}

.preview-block :deep(.el-table__header th) {
  height: 32px;
  background: #ffffff;
  color: #909399;
  font-weight: 700;
}

.preview-block :deep(.el-table__row) {
  height: 32px;
}

.preview-block :deep(.el-table .cell) {
  line-height: 18px;
}

:global(.import-result-dialog.el-dialog) {
  width: min(70vw, 1800px) !important;
  min-width: min(1280px, calc(100vw - 112px));
  height: min(86vh, 980px);
  max-height: calc(100vh - 72px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  border-radius: 6px;
  text-align: left;
  overflow: hidden;
}

:global(.import-result-dialog .el-dialog__header),
:global(.import-result-dialog .el-dialog__body),
:global(.import-result-dialog .el-dialog__footer) {
  padding: 8px 16px;
}

:global(.import-result-dialog .el-dialog__header) {
  margin: 0;
  text-align: left;
}

:global(.import-result-dialog .el-dialog__footer) {
  flex-shrink: 0;
}

:global(.import-result-dialog .el-dialog__headerbtn) {
  top: 5px;
  right: 8px;
  width: 32px;
  height: 32px;
}

:global(.import-result-dialog .el-dialog__title) {
  color: #303133;
  font-size: 20px;
  font-weight: 700;
  text-align: left;
}

:global(.import-result-dialog .el-dialog__body) {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

:global(.import-result-dialog .el-dialog__footer .el-button) {
  height: 36px;
  min-width: 86px;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 700;
}
</style>

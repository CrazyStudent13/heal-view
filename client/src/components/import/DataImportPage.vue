<template>
  <div class="data-import-page">
    <section class="history-panel">
      <div class="panel-toolbar">
        <div class="panel-title">
          <h2>{{ t('import.historyTitle') }}</h2>
          <span>{{ t('import.historyCount', { count: history.length }) }}</span>
        </div>

        <div class="toolbar-actions">
          <el-popconfirm :title="t('import.confirmClearData')" @confirm="clearData">
            <template #reference>
              <el-button class="toolbar-button danger-soft" type="danger" plain :icon="Delete" :loading="clearing">
                {{ t('import.clearData') }}
              </el-button>
            </template>
          </el-popconfirm>

          <el-button
            type="danger"
            plain
            class="toolbar-button danger-soft"
            :icon="Delete"
            :disabled="selectedRows.length === 0"
            @click="deleteSelected"
          >
            {{ t('import.deleteSelected') }}
          </el-button>

          <el-button class="toolbar-button primary-action" type="primary" :icon="Upload" @click="openUploadDialog">
            {{ t('import.uploadArchive') }}
          </el-button>
        </div>
      </div>

      <el-table
        v-if="!loadingHistory && !historyError"
        :data="history"
        class="history-table"
        height="100%"
        stripe
        @selection-change="selectedRows = $event"
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
              <el-button class="action-link view-link" type="primary" link :icon="View" @click="showRecord(row)">{{ t('common.view') }}</el-button>
              <el-button class="action-link delete-link" type="danger" link :icon="Delete" @click="removeHistory(row.importId || row.id)">{{ t('common.delete') }}</el-button>
              <el-button
                v-if="canImport(row)"
                type="success"
                link
                class="action-link import-link"
                :icon="Upload"
                :loading="activeImportId === row.importId"
                @click="commitHistoryImport(row.importId)"
              >
                {{ t('import.parse') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('import.noHistory')" :image-size="120" />
        </template>
      </el-table>
      <AsyncState
        v-else
        class="history-state"
        :loading="loadingHistory"
        :error="historyError"
        :show-retry="Boolean(historyError)"
        @retry="loadHistory"
      />
    </section>

    <el-dialog
      v-model="uploadDialogVisible"
      :title="t('import.uploadArchive')"
      width="720px"
      class="import-upload-dialog"
      :close-on-click-modal="!parsing"
      @closed="resetUpload"
    >
      <div class="platform-selector">
        <span>{{ t('import.platform') }}</span>
        <el-radio-group v-model="platform" :disabled="parsing">
          <el-radio-button value="xiaomi">{{ t('import.xiaomi') }}</el-radio-button>
          <el-radio-button value="huawei">{{ t('import.huawei') }}</el-radio-button>
        </el-radio-group>
      </div>

      <el-upload
        v-model:file-list="fileList"
        class="archive-uploader"
        drag
        action="#"
        accept=".zip"
        :auto-upload="false"
        :multiple="true"
        :disabled="!platform || parsing"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-title">
          {{ platform ? t('import.dropArchive') : t('import.selectPlatformFirst') }}
        </div>
        <template #tip>
          <div class="upload-tip">{{ t('import.uploadTip') }}</div>
        </template>
      </el-upload>

      <el-alert
        v-if="checkingArchive"
        class="upload-alert"
        :title="t('import.checkingArchive')"
        type="info"
        show-icon
        :closable="false"
      />
      <el-alert
        v-else-if="archiveError"
        class="upload-alert"
        :title="archiveError"
        type="error"
        show-icon
        :closable="false"
      />

      <template #footer>
        <el-button :disabled="parsing" @click="uploadDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="parsing"
          :disabled="!platform || fileList.length === 0 || checkingArchive"
          @click="parseArchives"
        >
          {{ t('import.startParsing') }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="resultDialogVisible"
      :title="t('import.healthData')"
      width="70vw"
      top="4vh"
      class="import-result-dialog"
    >
      <div v-if="currentResult" class="result-panel">
        <div :class="['result-head', currentResult.status]">
          <el-icon class="result-icon">
            <CircleCheckFilled v-if="['success', 'completed'].includes(currentResult.status)" />
            <WarningFilled v-else-if="currentResult.status === 'partial'" />
            <CircleCloseFilled v-else />
          </el-icon>
          <div>
            <h3>{{ currentResult.title }}</h3>
            <p>{{ currentResult.message }}</p>
          </div>
        </div>

        <div class="result-meta">
          <span>{{ t('import.platformValue', { value: shortPlatformLabel(currentResult.platformLabel || currentResult.platform) }) }}</span>
          <span>{{ currentResult.fileName || '--' }}</span>
          <span>{{ t('import.archiveSizeValue', { value: currentResult.fileSizeText || formatSize(currentResult.fileSize) }) }}</span>
        </div>

        <el-alert
          v-if="currentResult.reasons?.length"
          class="result-alert"
          :title="currentResult.status === 'failed' ? t('import.parseFailed') : t('import.partialFailure')"
          type="warning"
          show-icon
          :closable="false"
        >
          <ul class="reason-list">
            <li v-for="reason in currentResult.reasons" :key="reason">{{ reason }}</li>
          </ul>
        </el-alert>

        <div v-if="currentResult.previewItems?.length" class="preview-block">
          <div class="block-title">{{ t('import.previewTitle') }}</div>
          <el-table :data="currentResult.previewItems" size="small" height="100%">
            <el-table-column prop="date" :label="t('import.dateRange')" width="190" show-overflow-tooltip />
            <el-table-column prop="category" :label="t('import.dataItem')" width="130" show-overflow-tooltip />
            <el-table-column prop="value" :label="t('import.parseSummary')" min-width="320" show-overflow-tooltip />
            <el-table-column prop="target" :label="t('import.writeTarget')" width="190" show-overflow-tooltip />
            <el-table-column prop="source" :label="t('import.sourceFile')" min-width="320" show-overflow-tooltip />
          </el-table>
        </div>
      </div>

      <template #footer>
        <el-button @click="resultDialogVisible = false">{{ t('common.close') }}</el-button>
        <el-button
          v-if="currentResult?.status === 'completed'"
          type="primary"
          @click="viewDashboard"
        >
          {{ t('import.viewDashboard') }}
        </el-button>
        <el-button
          v-else-if="currentResult?.importId && currentResult?.status !== 'failed'"
          type="primary"
          :loading="activeImportId === currentResult.importId"
          @click="commitHistoryImport(currentResult.importId)"
        >
          {{ t('import.commitToDatabase') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import {
  ElAlert,
  ElButton,
  ElDialog,
  ElEmpty,
  ElIcon,
  ElMessage,
  ElMessageBox,
  ElPopconfirm,
  ElRadioButton,
  ElRadioGroup,
  ElTable,
  ElTableColumn,
  ElTag,
  ElUpload,
} from 'element-plus';
import {
  CircleCheckFilled,
  CircleCloseFilled,
  Delete,
  Upload,
  UploadFilled,
  View,
  WarningFilled
} from '@element-plus/icons-vue';
import {
  clearImportedData,
  commitImportArchive,
  deleteImportHistory,
  getImportHistory,
  parseImportArchive
} from '../../api/fitnessApi.js';
import { normalizeRequestError } from '../../utils/requestState.js';
import AsyncState from '../common/AsyncState.vue';
import { useLocaleStore } from '../../stores/localeStore.js';

const emit = defineEmits(['imported', 'view-dashboard']);
const { t } = useLocaleStore();

const MAX_FILE_SIZE = 200 * 1024 * 1024;

const history = ref([]);
const selectedRows = ref([]);
const loadingHistory = ref(false);
const historyError = ref('');
const uploadDialogVisible = ref(false);
const resultDialogVisible = ref(false);
const platform = ref('xiaomi');
const fileList = ref([]);
const currentResult = ref(null);
const parsing = ref(false);
const checkingArchive = ref(false);
const archiveError = ref('');
const activeImportId = ref('');
const clearing = ref(false);

function platformLabel(value) {
  return value === 'huawei' ? t('import.huawei') : t('import.xiaomi');
}

function shortPlatformLabel(value) {
  if (value === 'huawei' || value === t('import.huawei')) return t('import.huaweiShort');
  if (value === 'xiaomi' || value === t('import.xiaomi')) return t('import.xiaomiShort');
  return value || '--';
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
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 19);
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value)) return '--';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function overviewFromResult(row) {
  const result = row.result || {};
  return result.overview || result.message || '--';
}

function normalizeIssue(issue) {
  if (typeof issue === 'string') return issue;
  return [
    issue?.source,
    issue?.rowNumber ? t('import.rowNumber', { row: issue.rowNumber }) : '',
    issue?.message || issue?.code
  ].filter(Boolean).join('：');
}

function normalizeResult(response, file) {
  const issues = response.issues || [];
  const status = issues.length > 0 ? 'partial' : 'success';
  const counts = response.summary?.counts || {};
  const dateRange = response.summary?.dateRange;
  const recordCount = Number(counts.metricSamples || 0)
    + Number(counts.bloodPressureRecords || 0)
    + Number(counts.sleepSessions || 0)
    + Number(counts.sportRecords || 0);

  return {
    importId: response.importId,
    status,
    title: status === 'partial' ? t('import.parsePartialTitle') : t('import.parseSuccessTitle'),
    message: status === 'partial'
      ? t('import.parsePartialMessage')
      : t('import.parseSuccessMessage'),
    overview: dateRange
      ? t('import.dateRangeValue', { start: dateRange.start, end: dateRange.end })
      : t('import.recordCount', { count: recordCount }),
    platform: response.platform,
    platformLabel: response.platformLabel || platformLabel(platform.value),
    fileName: response.fileName || file.name,
    fileSize: response.fileSize || file.size,
    fileSizeText: formatSize(response.fileSize || file.size),
    reasons: issues.map(normalizeIssue),
    previewItems: response.previewRows || []
  };
}

function resultFromHistory(row) {
  const result = row.result || {};
  return {
    importId: row.importId,
    status: result.status || row.status,
    title: row.status === 'completed' ? t('import.dataImportedTitle') : statusMeta(row.status).label,
    message: row.status === 'completed' ? t('import.dataImportedMessage') : t('import.confirmBeforeImport'),
    platform: row.platform,
    platformLabel: row.platformLabel || platformLabel(row.platform),
    fileName: row.fileName,
    fileSize: row.fileSize,
    fileSizeText: formatSize(row.fileSize),
    reasons: result.reasons || [],
    previewItems: result.previewItems || []
  };
}

async function isEncryptedZip(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const readUInt16 = (index) => bytes[index] | (bytes[index + 1] << 8);
  const readUInt32 = (index) => (bytes[index] | (bytes[index + 1] << 8) | (bytes[index + 2] << 16) | (bytes[index + 3] << 24)) >>> 0;

  for (let index = 0; index + 10 <= bytes.length; index += 1) {
    const signature = readUInt32(index);
    if (signature === 0x04034b50 && index + 8 <= bytes.length) {
      const flags = readUInt16(index + 6);
      if (flags & 1 || flags & 64) return true;
    }
    if (signature === 0x02014b50 && index + 10 <= bytes.length) {
      const flags = readUInt16(index + 8);
      if (flags & 1 || flags & 64) return true;
    }
  }
  return false;
}

function openUploadDialog() {
  uploadDialogVisible.value = true;
}

async function handleFileChange(file) {
  archiveError.value = '';
  const raw = file.raw;
  if (!raw) return;

  if (!/\.zip$/i.test(raw.name)) {
    fileList.value = fileList.value.filter((item) => item.uid !== file.uid);
    ElMessage.error(t('import.invalidZip', { name: raw.name }));
    return;
  }

  if (raw.size > MAX_FILE_SIZE) {
    fileList.value = fileList.value.filter((item) => item.uid !== file.uid);
    ElMessage.error(t('import.fileTooLarge', { name: raw.name }));
    return;
  }

  checkingArchive.value = true;
  try {
    if (await isEncryptedZip(raw)) {
      fileList.value = fileList.value.filter((item) => item.uid !== file.uid);
      archiveError.value = t('import.encryptedArchive');
      ElMessage.error(t('import.encryptedFile', { name: raw.name }));
    }
  } catch (error) {
    console.warn('Unable to inspect archive:', error);
  } finally {
    checkingArchive.value = false;
  }
}

function handleFileRemove() {
  archiveError.value = '';
}

function resetUpload() {
  if (parsing.value) return;
  fileList.value = [];
  archiveError.value = '';
}

async function parseArchives() {
  const files = fileList.value.map((file) => file.raw).filter(Boolean);
  if (files.length === 0) {
    ElMessage.warning(t('import.selectArchiveFirst'));
    return;
  }

  parsing.value = true;
  try {
    const parsedResults = [];
    for (const file of files) {
      const response = await parseImportArchive(file, platform.value);
      parsedResults.push(normalizeResult(response, file));
    }

    currentResult.value = parsedResults.length === 1
      ? parsedResults[0]
      : {
          importId: null,
          status: parsedResults.some((item) => item.status === 'partial') ? 'partial' : 'success',
          title: t('import.batchParseTitle'),
          message: t('import.batchParseMessage', { count: parsedResults.length }),
          platformLabel: platformLabel(platform.value),
          fileName: t('import.archiveCount', { count: parsedResults.length }),
          fileSizeText: formatSize(files.reduce((sum, file) => sum + file.size, 0)),
          reasons: parsedResults.flatMap((item) => item.reasons.map((reason) => `${item.fileName}：${reason}`)),
          previewItems: parsedResults.flatMap((item) => item.previewItems).slice(0, 50)
        };

    uploadDialogVisible.value = false;
    resultDialogVisible.value = true;
    await loadHistory();
  } catch (error) {
    ElMessage.error(error.message || t('import.parseFailedMessage'));
  } finally {
    parsing.value = false;
  }
}

function showRecord(row) {
  currentResult.value = resultFromHistory(row);
  resultDialogVisible.value = true;
}

async function commitHistoryImport(importId) {
  activeImportId.value = importId;
  try {
    const previousResult = currentResult.value;
    const response = await commitImportArchive(importId);
    const importedRows = response.importedRows || {};
    const totalRows = Number(importedRows.fitnessRows || 0)
      + Number(importedRows.sportRows || 0)
      + Number(importedRows.aggregateRows || 0)
      + Number(importedRows.bloodPressureRows || 0);
    const dateRangeText = response.dateRange
      ? t('import.healthDateRange', { start: response.dateRange.start, end: response.dateRange.end })
      : '';

    currentResult.value = {
      ...previousResult,
      importId,
      status: 'completed',
      title: t('import.importSuccessTitle'),
      message: [t('import.importSuccessMessage', { count: totalRows }), dateRangeText].filter(Boolean).join('，'),
      reasons: [],
      importedRows
    };
    resultDialogVisible.value = true;
    ElMessage.success(t('import.importSuccessTitle'));
    emit('imported');
    await loadHistory();
  } catch (error) {
    ElMessage.error(error.message || t('import.importFailed'));
  } finally {
    activeImportId.value = '';
  }
}

function viewDashboard() {
  resultDialogVisible.value = false;
  emit('view-dashboard');
}

async function loadHistory() {
  loadingHistory.value = true;
  historyError.value = '';
  try {
    const response = await getImportHistory();
    history.value = response.records || [];
  } catch (error) {
    historyError.value = normalizeRequestError(error) || t('import.historyLoadFailed');
    console.error('Failed to load import history:', error);
  } finally {
    loadingHistory.value = false;
  }
}

async function removeHistory(importId) {
  await deleteImportHistory(importId);
  await loadHistory();
}

async function deleteSelected() {
  if (selectedRows.value.length === 0) return;
  await ElMessageBox.confirm(t('import.confirmDeleteSelected', { count: selectedRows.value.length }), t('import.deleteSelected'), {
    type: 'warning',
    confirmButtonText: t('common.delete'),
    cancelButtonText: t('common.cancel')
  });
  for (const row of selectedRows.value) {
    await deleteImportHistory(row.importId || row.id);
  }
  selectedRows.value = [];
  await loadHistory();
}

async function clearData() {
  clearing.value = true;
  try {
    await clearImportedData();
    ElMessage.success(t('import.clearSuccess'));
    emit('imported');
    await loadHistory();
  } catch (error) {
    ElMessage.error(error.message || t('import.clearFailed'));
  } finally {
    clearing.value = false;
  }
}

onMounted(loadHistory);
</script>

<style scoped lang="scss">
.data-import-page {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  background: #f5f5f5;
}

.history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  box-shadow: none;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 82px;
  padding: 20px 24px;
  border-bottom: 1px solid #ebeef5;
}

.panel-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.panel-title h2 {
  margin: 0;
  color: #303133;
  font-size: 22px;
  font-weight: 700;
}

.panel-title span {
  color: #909399;
  font-size: 16px;
  font-weight: 600;
}

.toolbar-actions,
.row-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.toolbar-button {
  height: 40px;
  padding: 0 18px;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 700;
}

.primary-action {
  background: #409eff;
  border-color: #409eff;
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.18);
}

.danger-soft {
  background: #fff5f5;
  border-color: #ffd6d6;
  color: #f56c6c;
}

.danger-soft.is-disabled,
.danger-soft.is-disabled:hover {
  background: #fff5f5;
  border-color: #ffe5e5;
  color: #f8b4b4;
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

.history-state {
  flex: 1;
  min-height: 240px;
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

.row-actions {
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

.platform-selector {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  color: #303133;
  font-size: 14px;
  font-weight: 500;
}

.archive-uploader :deep(.el-upload-dragger) {
  border-radius: 8px;
  padding: 34px 20px;
  background: #f7f8fa;
}

.upload-icon {
  font-size: 46px;
  color: #409eff;
}

.upload-title {
  margin-top: 8px;
  font-size: 16px;
  color: #303133;
}

.upload-tip {
  margin-top: 8px;
  color: #909399;
  font-size: 13px;
}

.upload-alert,
.result-alert {
  margin-top: 16px;
}

:global(.import-upload-dialog .el-dialog__header),
:global(.import-upload-dialog .el-dialog__body),
:global(.import-upload-dialog .el-dialog__footer),
:global(.import-result-dialog .el-dialog__header),
:global(.import-result-dialog .el-dialog__body),
:global(.import-result-dialog .el-dialog__footer) {
  padding: 8px 16px;
}

:global(.import-upload-dialog .el-dialog__header),
:global(.import-result-dialog .el-dialog__header) {
  margin: 0;
  text-align: left;
}

:global(.import-upload-dialog .el-dialog__footer),
:global(.import-result-dialog .el-dialog__footer) {
  flex-shrink: 0;
}

:global(.import-upload-dialog .el-dialog__headerbtn),
:global(.import-result-dialog .el-dialog__headerbtn) {
  top: 5px;
  right: 8px;
  width: 32px;
  height: 32px;
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

.result-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 0;
  text-align: left;
}

.preview-block :deep(.el-table .cell) {
  line-height: 18px;
}

@media (min-width: 901px) {
  :global(.import-result-dialog.el-dialog) {
    min-height: 0;
  }
}

@media (max-width: 900px) {
  .data-import-page {
    height: auto;
    min-height: calc(100vh - 64px);
    padding: 12px;
    overflow: visible;
  }

  .history-panel {
    min-height: 620px;
  }

  .panel-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar-actions {
    flex-wrap: wrap;
  }
}
</style>


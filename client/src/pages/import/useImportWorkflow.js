import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  clearImportedData,
  commitImportArchive,
  deleteImportHistory,
  getImportHistory,
  parseImportArchive
} from '@/api/fitnessApi.js';
import { formatNumber } from '@/i18n/index.js';
import { useLocaleStore } from '@/stores/localeStore.js';
import { normalizeRequestError } from '@/utils/requestState.js';

export function useImportWorkflow(emit) {
  const { t } = useLocaleStore();
  const history = ref([]);
  const selectedRows = ref([]);
  const loadingHistory = ref(false);
  const historyError = ref('');
  const uploadDialogVisible = ref(false);
  const resultDialogVisible = ref(false);
  const currentResult = ref(null);
  const parsing = ref(false);
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

  function formatSize(size) {
    const value = Number(size);
    if (!Number.isFinite(value)) return '--';
    if (value < 1024) return `${formatNumber(value)} B`;
    if (value < 1024 * 1024) return `${formatNumber(value / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB`;
    return `${formatNumber(value / 1024 / 1024, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
  }

  function normalizeIssue(issue) {
    if (typeof issue === 'string') return issue;
    return [
      issue?.source,
      issue?.rowNumber ? t('import.rowNumber', { row: issue.rowNumber }) : '',
      issue?.message || issue?.code
    ].filter(Boolean).join(t('common.labelSeparator'));
  }

  function normalizeResult(response, file, selectedPlatform) {
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
      platformLabel: response.platformLabel || platformLabel(selectedPlatform),
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
      platformLabel: shortPlatformLabel(row.platformLabel || row.platform),
      fileName: row.fileName,
      fileSize: row.fileSize,
      fileSizeText: formatSize(row.fileSize),
      reasons: result.reasons || [],
      previewItems: result.previewItems || []
    };
  }

  async function parseArchives({ platform, files }) {
    parsing.value = true;
    try {
      const parsedResults = [];
      for (const file of files) {
        const response = await parseImportArchive(file, platform);
        parsedResults.push(normalizeResult(response, file, platform));
      }

      currentResult.value = parsedResults.length === 1
        ? parsedResults[0]
        : {
            importId: null,
            status: parsedResults.some((item) => item.status === 'partial') ? 'partial' : 'success',
            title: t('import.batchParseTitle'),
            message: t('import.batchParseMessage', { count: parsedResults.length }),
            platformLabel: platformLabel(platform),
            fileName: t('import.archiveCount', { count: parsedResults.length }),
            fileSizeText: formatSize(files.reduce((sum, file) => sum + file.size, 0)),
            reasons: parsedResults.flatMap((item) => item.reasons.map((reason) => `${item.fileName}${t('common.labelSeparator')}${reason}`)),
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
        message: [t('import.importSuccessMessage', { count: totalRows }), dateRangeText].filter(Boolean).join(t('common.listSeparator')),
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

  async function loadHistory() {
    loadingHistory.value = true;
    historyError.value = '';
    try {
      const response = await getImportHistory();
      history.value = response.records || [];
    } catch (error) {
      historyError.value = normalizeRequestError(error, t) || t('import.historyLoadFailed');
      console.error('Failed to load import history:', error);
    } finally {
      loadingHistory.value = false;
    }
  }

  async function removeHistory(importId) {
    try {
      await deleteImportHistory(importId);
      await loadHistory();
    } catch (error) {
      ElMessage.error(error.message || t('common.delete'));
    }
  }

  async function deleteSelected() {
    if (selectedRows.value.length === 0) return;
    try {
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
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        ElMessage.error(error.message || t('common.delete'));
      }
    }
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

  function openUploadDialog() {
    uploadDialogVisible.value = true;
  }

  function showRecord(row) {
    currentResult.value = resultFromHistory(row);
    resultDialogVisible.value = true;
  }

  function viewDashboard() {
    resultDialogVisible.value = false;
    emit('view-dashboard');
  }

  onMounted(loadHistory);

  return {
    history,
    selectedRows,
    loadingHistory,
    historyError,
    uploadDialogVisible,
    resultDialogVisible,
    currentResult,
    parsing,
    activeImportId,
    clearing,
    openUploadDialog,
    parseArchives,
    commitHistoryImport,
    loadHistory,
    removeHistory,
    deleteSelected,
    clearData,
    showRecord,
    viewDashboard
  };
}

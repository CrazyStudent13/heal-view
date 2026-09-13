import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { clearImportedData, commitImportArchive, deleteImportHistory, getImportHistory } from '@/api/fitnessApi.js';
import { formatNumber } from '@/i18n/index.js';
import { useLocaleStore } from '@/stores/localeStore.js';
import { normalizeRequestError } from '@/utils/requestState.js';

export function useImportHistory({ currentResult, resultDialogVisible, emit }) {
  const { t } = useLocaleStore();
  const history = ref([]), selectedRows = ref([]), loadingHistory = ref(false), historyError = ref('');
  const activeImportId = ref(''), clearing = ref(false);
  const statusDefinitions = {
    pending: ['import.statusPending', 'warning'],
    queued: ['import.statusPending', 'warning'],
    partial: ['import.statusPartial', 'warning'],
    success: ['import.statusSuccess', 'success'],
    completed: ['import.statusCompleted', 'success'],
    failed: ['import.statusFailed', 'danger']
  };

  function shortPlatformLabel(value) {
    if (value === 'huawei' || value === t('import.huawei')) return t('import.huaweiShort');
    if (value === 'xiaomi' || value === t('import.xiaomi')) return t('import.xiaomiShort');
    return value || '--';
  }
  function statusMeta(status) {
    const definition = statusDefinitions[status];
    if (!definition) return { label: status || t('common.unknown'), type: 'info' };
    const [label, type] = definition;
    return { label: t(label), type };
  }
  function formatSize(size) {
    const value = Number(size); if (!Number.isFinite(value)) return '--';
    if (value < 1024) return `${formatNumber(value)} B`;
    if (value < 1024 * 1024) return `${formatNumber(value / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB`;
    return `${formatNumber(value / 1024 / 1024, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
  }
  function resultFromHistory(row) {
    const result = row.result || {};
    return { importId: row.importId, status: result.status || row.status, title: row.status === 'completed' ? t('import.dataImportedTitle') : statusMeta(row.status).label, message: row.status === 'completed' ? t('import.dataImportedMessage') : t('import.confirmBeforeImport'), platform: row.platform, platformLabel: shortPlatformLabel(row.platformLabel || row.platform), fileName: row.fileName, fileSize: row.fileSize, fileSizeText: formatSize(row.fileSize), reasons: result.reasons || [], previewItems: result.previewItems || [] };
  }
  async function loadHistory() {
    loadingHistory.value = true; historyError.value = '';
    try { history.value = (await getImportHistory()).records || []; }
    catch (error) { historyError.value = normalizeRequestError(error, t) || t('import.historyLoadFailed'); console.error('Failed to load import history:', error); }
    finally { loadingHistory.value = false; }
  }
  async function commitHistoryImport(importId) {
    activeImportId.value = importId;
    try {
      const previousResult = currentResult.value, response = await commitImportArchive(importId), importedRows = response.importedRows || {};
      const totalRows = Number(importedRows.fitnessRows || 0) + Number(importedRows.sportRows || 0) + Number(importedRows.aggregateRows || 0) + Number(importedRows.bloodPressureRows || 0);
      const dateRangeText = response.dateRange ? t('import.healthDateRange', { start: response.dateRange.start, end: response.dateRange.end }) : '';
      currentResult.value = { ...previousResult, importId, status: 'completed', title: t('import.importSuccessTitle'), message: [t('import.importSuccessMessage', { count: totalRows }), dateRangeText].filter(Boolean).join(t('common.listSeparator')), reasons: [], importedRows };
      resultDialogVisible.value = true; ElMessage.success(t('import.importSuccessTitle')); emit('imported'); await loadHistory();
    } catch (error) { ElMessage.error(error.message || t('import.importFailed')); }
    finally { activeImportId.value = ''; }
  }
  async function removeHistory(importId) { try { await deleteImportHistory(importId); await loadHistory(); } catch (error) { ElMessage.error(error.message || t('common.delete')); } }
  async function deleteSelected() {
    if (!selectedRows.value.length) return;
    try {
      await ElMessageBox.confirm(t('import.confirmDeleteSelected', { count: selectedRows.value.length }), t('import.deleteSelected'), { type: 'warning', confirmButtonText: t('common.delete'), cancelButtonText: t('common.cancel') });
      for (const row of selectedRows.value) await deleteImportHistory(row.importId || row.id);
      selectedRows.value = []; await loadHistory();
    } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || t('common.delete')); }
  }
  async function clearData() {
    clearing.value = true;
    try { await clearImportedData(); ElMessage.success(t('import.clearSuccess')); emit('imported'); await loadHistory(); }
    catch (error) { ElMessage.error(error.message || t('import.clearFailed')); }
    finally { clearing.value = false; }
  }
  return { history, selectedRows, loadingHistory, historyError, activeImportId, clearing, loadHistory, commitHistoryImport, removeHistory, deleteSelected, clearData, resultFromHistory };
}

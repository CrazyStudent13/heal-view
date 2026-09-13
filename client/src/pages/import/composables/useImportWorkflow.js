import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useLocaleStore } from '@/stores/localeStore.js';
import { useImportArchive } from './useImportArchive.js';
import { useImportHistory } from './useImportHistory.js';

export function useImportWorkflow(emit) {
  const { t } = useLocaleStore();
  const uploadDialogVisible = ref(false);
  const resultDialogVisible = ref(false);
  const currentResult = ref(null);
  const { parsing, parseArchives: parseArchiveFiles } = useImportArchive();
  const historyState = useImportHistory({ currentResult, resultDialogVisible, emit });

  async function parseArchives(payload) {
    try {
      currentResult.value = await parseArchiveFiles(payload);
      uploadDialogVisible.value = false;
      resultDialogVisible.value = true;
      await historyState.loadHistory();
    } catch (error) {
      ElMessage.error(error.message || t('import.parseFailedMessage'));
    }
  }

  function openUploadDialog() {
    uploadDialogVisible.value = true;
  }

  function showRecord(row) {
    currentResult.value = historyState.resultFromHistory(row);
    resultDialogVisible.value = true;
  }

  function viewDashboard() {
    resultDialogVisible.value = false;
    emit('view-dashboard');
  }

  onMounted(historyState.loadHistory);

  return {
    ...historyState,
    uploadDialogVisible,
    resultDialogVisible,
    currentResult,
    parsing,
    openUploadDialog,
    parseArchives,
    showRecord,
    viewDashboard
  };
}

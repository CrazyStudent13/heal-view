<template>
  <PageContainer
    class="data-import-page"
    :title="t('import.historyTitle')"
    card
    full-height
    content-width="none"
    content-padding="0"
  >
    <template #title-meta>
      <span class="history-count">{{ t('import.historyCount', { count: history.length }) }}</span>
    </template>

    <template #actions>
      <ImportToolbar
        :selected-count="selectedRows.length"
        :clearing="clearing"
        @clear-data="clearData"
        @delete-selected="deleteSelected"
        @upload="openUploadDialog"
      />
    </template>

    <ImportHistoryTable
      :history="history"
      :loading="loadingHistory"
      :error="historyError"
      :active-import-id="activeImportId"
      @selection-change="selectedRows = $event"
      @view="showRecord"
      @delete="removeHistory"
      @commit="commitHistoryImport"
      @retry="loadHistory"
    />

    <ArchiveUploadDialog
      v-model="uploadDialogVisible"
      :parsing="parsing"
      @parse="parseArchives"
    />

    <ImportResultDialog
      v-model="resultDialogVisible"
      :result="currentResult"
      :active-import-id="activeImportId"
      @view-dashboard="viewDashboard"
      @commit="commitHistoryImport"
    />
  </PageContainer>
</template>

<script setup>
import PageContainer from '@/components/ui/PageContainer.vue';
import { useLocaleStore } from '@/stores/localeStore.js';
import ArchiveUploadDialog from '@/pages/import/components/ArchiveUploadDialog.vue';
import ImportHistoryTable from '@/pages/import/components/ImportHistoryTable.vue';
import ImportResultDialog from '@/pages/import/components/ImportResultDialog.vue';
import ImportToolbar from '@/pages/import/components/ImportToolbar.vue';
import { useImportWorkflow } from '@/pages/import/composables/useImportWorkflow.js';

const emit = defineEmits(['imported', 'view-dashboard']);
const { t } = useLocaleStore();
const {
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
} = useImportWorkflow(emit);
</script>

<style scoped lang="scss">
.data-import-page {
  flex: 1;
}

.history-count {
  color: #909399;
  font-size: 16px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .data-import-page {
    padding: 12px;
    min-height: calc(100vh - 64px);
  }

  .data-import-page :deep(.page-container__shell) {
    min-height: 620px;
  }
}
</style>

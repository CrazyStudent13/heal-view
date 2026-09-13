<template>
  <div class="import-toolbar">
    <el-popconfirm :title="t('import.confirmClearData')" @confirm="$emit('clear-data')">
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
      :disabled="selectedCount === 0"
      @click="$emit('delete-selected')"
    >
      {{ t(selectedCount ? 'import.deleteSelectedCount' : 'import.deleteSelected', { count: selectedCount }) }}
    </el-button>

    <el-button class="toolbar-button primary-action" type="primary" :icon="Upload" @click="$emit('upload')">
      {{ t('import.uploadArchive') }}
    </el-button>
  </div>
</template>

<script setup>
import { ElButton, ElPopconfirm } from 'element-plus';
import { Delete, Upload } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';

defineProps({
  selectedCount: {
    type: Number,
    default: 0
  },
  clearing: {
    type: Boolean,
    default: false
  }
});

defineEmits(['clear-data', 'delete-selected', 'upload']);

const { t } = useLocaleStore();
</script>

<style scoped lang="scss">
.import-toolbar {
  display: flex;
  gap: 10px;
}

.toolbar-button {
  height: 40px;
  padding: 0 18px;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 700;
}

.primary-action {
  background: var(--primary-color);
  border-color: var(--primary-color);
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.18);
}

.danger-soft {
  background: #fff5f5;
  border-color: #ffd6d6;
  color: var(--danger-color);
}

.danger-soft.is-disabled,
.danger-soft.is-disabled:hover {
  background: #fff5f5;
  border-color: #ffe5e5;
  color: #f8b4b4;
}
</style>

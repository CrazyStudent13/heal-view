<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('import.uploadArchive')"
    width="720px"
    class="import-upload-dialog"
    :close-on-click-modal="!parsing"
    @update:model-value="$emit('update:modelValue', $event)"
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
      <el-button :disabled="parsing" @click="$emit('update:modelValue', false)">{{ t('common.cancel') }}</el-button>
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
</template>

<script setup>
import { ElAlert, ElButton, ElDialog, ElIcon, ElMessage, ElRadioButton, ElRadioGroup, ElUpload } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  parsing: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'parse']);
const { t } = useLocaleStore();

const MAX_FILE_SIZE = 200 * 1024 * 1024;
const platform = ref('xiaomi');
const fileList = ref([]);
const checkingArchive = ref(false);
const archiveError = ref('');

function readUInt16(bytes, index) {
  return bytes[index] | (bytes[index + 1] << 8);
}

function readUInt32(bytes, index) {
  return (bytes[index] | (bytes[index + 1] << 8) | (bytes[index + 2] << 16) | (bytes[index + 3] << 24)) >>> 0;
}

async function isEncryptedZip(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  for (let index = 0; index + 10 <= bytes.length; index += 1) {
    const signature = readUInt32(bytes, index);
    if (signature === 0x04034b50 && index + 8 <= bytes.length) {
      const flags = readUInt16(bytes, index + 6);
      if (flags & 1 || flags & 64) return true;
    }
    if (signature === 0x02014b50 && index + 10 <= bytes.length) {
      const flags = readUInt16(bytes, index + 8);
      if (flags & 1 || flags & 64) return true;
    }
  }
  return false;
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
  if (props.parsing) return;
  fileList.value = [];
  archiveError.value = '';
}

function parseArchives() {
  const files = fileList.value.map((file) => file.raw).filter(Boolean);
  if (files.length === 0) {
    ElMessage.warning(t('import.selectArchiveFirst'));
    return;
  }
  emit('parse', { platform: platform.value, files });
}
</script>

<style scoped lang="scss">
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

.upload-alert {
  margin-top: 16px;
}

:global(.import-upload-dialog .el-dialog__header),
:global(.import-upload-dialog .el-dialog__body),
:global(.import-upload-dialog .el-dialog__footer) {
  padding: 8px 16px;
}

:global(.import-upload-dialog .el-dialog__header) {
  margin: 0;
  text-align: left;
}

:global(.import-upload-dialog .el-dialog__footer) {
  flex-shrink: 0;
}

:global(.import-upload-dialog .el-dialog__headerbtn) {
  top: 5px;
  right: 8px;
  width: 32px;
  height: 32px;
}
</style>

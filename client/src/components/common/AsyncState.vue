<template>
  <div
    class="async-state"
    :class="`async-state--${state}`"
    :aria-busy="loading"
    aria-live="polite"
  >
    <div v-if="loading" class="async-state__loading">
      <el-icon class="async-state__loading-icon is-loading" aria-hidden="true">
        <Loading />
      </el-icon>
      <span>{{ resolvedLoadingText }}</span>
    </div>

    <div v-else-if="errorMessage" class="async-state__error">
      <el-alert
        :title="resolvedErrorTitle"
        :description="errorMessage"
        type="error"
        show-icon
        :closable="false"
      />
      <el-button
        v-if="showRetry"
        class="async-state__retry"
        type="primary"
        plain
        :icon="Refresh"
        @click="$emit('retry')"
      >
        {{ resolvedRetryText }}
      </el-button>
    </div>

    <el-empty
      v-else-if="empty"
      class="async-state__empty"
      :description="resolvedEmptyDescription"
      :image-size="emptyImageSize"
    />

  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Loading, Refresh } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore.js';
import { normalizeErrorText } from '../../utils/requestState.js';

const localeStore = useLocaleStore();
const { t } = localeStore;

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: [String, Object, Error],
    default: null
  },
  empty: {
    type: Boolean,
    default: false
  },
  loadingText: {
    type: String,
    default: ''
  },
  errorTitle: {
    type: String,
    default: ''
  },
  emptyDescription: {
    type: String,
    default: ''
  },
  retryText: {
    type: String,
    default: ''
  },
  showRetry: {
    type: Boolean,
    default: false
  },
  emptyImageSize: {
    type: Number,
    default: 120
  }
});

defineEmits(['retry']);

const errorMessage = computed(() => normalizeErrorText(props.error));
const resolvedLoadingText = computed(() => props.loadingText || t('common.loading'));
const resolvedErrorTitle = computed(() => props.errorTitle || t('common.loadFailed'));
const resolvedEmptyDescription = computed(() => props.emptyDescription || t('common.empty'));
const resolvedRetryText = computed(() => props.retryText || t('common.retry'));
const state = computed(() => {
  if (props.loading) return 'loading';
  if (errorMessage.value) return 'error';
  if (props.empty) return 'empty';
  return 'ready';
});
</script>

<style scoped lang="scss">
.async-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

.async-state__loading,
.async-state__error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  padding: 24px;
  color: var(--text-secondary);
  text-align: center;
}

.async-state__loading {
  flex-direction: column;
  gap: 10px;
}

.async-state__loading-icon {
  color: var(--primary-color);
  font-size: 24px;
}

.async-state__error {
  flex-direction: column;
  gap: 14px;
}

.async-state__error :deep(.el-alert) {
  width: min(100%, 560px);
  text-align: left;
}

.async-state__retry {
  align-self: center;
}

.async-state__empty {
  flex: 1;
  min-height: 160px;
}
</style>

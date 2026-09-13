<template>
  <Transition name="dashboard-loading-fade">
    <div v-if="visible" class="dashboard-loading-overlay" role="status" aria-live="polite" :aria-label="label">
      <div class="dashboard-loading-overlay__content">
        <span class="dashboard-loading-overlay__spinner" aria-hidden="true" />
        <span>{{ label }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  active: { type: Boolean, default: false },
  delay: { type: Number, default: 160 }
});

const localeStore = useLocaleStore();
const label = computed(() => localeStore.t('common.loading'));
const visible = ref(false);
let showTimer = null;

function clearTimer() {
  if (showTimer !== null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
}

watch(() => props.active, active => {
  clearTimer();
  if (!active) {
    visible.value = false;
    return;
  }
  showTimer = setTimeout(() => {
    visible.value = true;
    showTimer = null;
  }, Math.max(0, props.delay));
}, { immediate: true });

onBeforeUnmount(clearTimer);
</script>

<style scoped lang="scss">
.dashboard-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--app-bg) 72%, transparent);
  backdrop-filter: blur(1px);
  pointer-events: all;
}

.dashboard-loading-overlay__content {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  color: var(--text-primary);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  box-shadow: var(--card-shadow);
  font-size: 14px;
}

.dashboard-loading-overlay__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--control-border);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: dashboard-loading-spin 0.8s linear infinite;
}

.dashboard-loading-fade-enter-active,
.dashboard-loading-fade-leave-active { transition: opacity 0.16s ease; }
.dashboard-loading-fade-enter-from,
.dashboard-loading-fade-leave-to { opacity: 0; }

@keyframes dashboard-loading-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .dashboard-loading-overlay__spinner { animation: none; }
  .dashboard-loading-fade-enter-active,
  .dashboard-loading-fade-leave-active { transition: none; }
}
</style>

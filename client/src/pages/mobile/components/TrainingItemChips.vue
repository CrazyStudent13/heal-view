<template>
  <nav class="item-chips" :aria-label="t('mobile.itemsNavLabel')">
    <div class="item-chips__track" role="tablist">
      <button
        v-for="item in items"
        :key="item.sessionItemId"
        type="button"
        role="tab"
        class="item-chip"
        :class="[
          `item-chip--${statusOf(item.sessionItemId)}`,
          { 'item-chip--active': item.sessionItemId === activeId }
        ]"
        :aria-selected="item.sessionItemId === activeId"
        @click="$emit('select', item.sessionItemId)"
      >
        <span class="item-chip__mark" aria-hidden="true">
          <van-icon v-if="statusOf(item.sessionItemId) === 'done'" name="success" />
          <van-icon v-else-if="statusOf(item.sessionItemId) === 'skipped'" name="arrow" />
          <span v-else class="item-chip__dot"></span>
        </span>
        <span class="item-chip__name">{{ item.exercise.name }}</span>
        <span v-if="progressOf(item)" class="item-chip__progress">{{ progressOf(item) }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  items: { type: Array, default: () => [] },
  activeId: { type: Number, default: null },
  // 逐项状态与完成组数由页面统一持有，chips 只负责展示，避免两处各算一遍。
  statuses: { type: Object, default: () => ({}) },
  progress: { type: Object, default: () => ({}) }
});

defineEmits(['select']);

const { t } = useLocaleStore();

function statusOf(sessionItemId) {
  return props.statuses[sessionItemId] || 'done';
}

// 部分完成时在 chip 上直接标出「2/3组」，不进面板也能看出哪些项没练完。
function progressOf(item) {
  if (statusOf(item.sessionItemId) !== 'partial') return '';
  const entry = props.progress[item.sessionItemId];
  if (!entry || entry.target <= 0) return '';
  return t('mobile.setsProgress', { done: entry.done, target: entry.target });
}
</script>

<style scoped lang="scss">
.item-chips {
  position: sticky;
  top: 112px;
  z-index: 8;
  background: var(--app-bg);
  border-bottom: 1px solid var(--card-border);
}

.item-chips__track {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.item-chips__track::-webkit-scrollbar {
  display: none;
}

.item-chip {
  display: flex;
  align-items: center;
  flex: none;
  gap: 6px;
  max-width: 190px;
  height: 40px;
  padding: 0 12px;
  color: var(--text-primary);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  font-size: 14px;
  white-space: nowrap;
}

.item-chip--active {
  color: var(--primary-color);
  border-color: var(--primary-color);
  background: var(--primary-light);
  font-weight: 600;
}

.item-chip__mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  font-size: 13px;
}

.item-chip--done .item-chip__mark {
  color: var(--primary-color);
}

.item-chip--partial .item-chip__mark {
  color: var(--warning-color);
}

.item-chip--partial .item-chip__dot {
  border-color: var(--warning-color);
  background: var(--warning-color);
}

.item-chip--skipped .item-chip__mark {
  color: var(--warning-color);
}

.item-chip__progress {
  flex: none;
  color: var(--warning-color);
  font-size: 12px;
  font-weight: 600;
}

.item-chip__dot {
  width: 8px;
  height: 8px;
  border: 1px solid var(--card-border);
  border-radius: 50%;
}

.item-chip__name {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

<template>
  <div class="view-mode-tabs">
    <button
      :class="['tab-btn', { active: modelValue === 'single' }]"
      @click="$emit('update:modelValue', 'single')"
    >
      <span class="tab-icon">📅</span>
      <span class="tab-label">单日视图</span>
    </button>
    <button
      :class="['tab-btn', { active: modelValue === 'compare' }]"
      @click="$emit('update:modelValue', 'compare')"
    >
      <span class="tab-icon">📊</span>
      <span class="tab-label">多日对比</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'single',
    validator: (value) => ['single', 'compare'].includes(value)
  }
});

defineEmits(['update:modelValue']);
</script>

<style scoped>
.view-mode-tabs {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s;
}

.tab-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.tab-btn.active {
  background: #e6f7ff;
  border-color: #1890ff;
  color: #1890ff;
  font-weight: 500;
}

.tab-icon {
  font-size: 16px;
}

.tab-label {
  white-space: nowrap;
}
</style>

<template>
  <div class="app-section-title" :class="`app-section-title--level-${level}`">
    <el-icon v-if="$slots.icon" class="section-title__icon">
      <slot name="icon" />
    </el-icon>
    <el-text :tag="headingTag" class="section-title__text">
      <slot />
    </el-text>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  level: {
    type: Number,
    default: 2,
    validator: value => [1, 2].includes(value)
  }
});

const headingTag = computed(() => props.level === 1 ? 'h1' : 'h2');
</script>

<style scoped>
.app-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--text-primary);
}

.app-section-title--level-1 {
  margin-bottom: 24px;
}

.app-section-title--level-2 {
  margin-bottom: 16px;
}

.section-title__icon {
  flex: 0 0 auto;
  color: var(--primary-color);
}

.app-section-title--level-1 .section-title__icon {
  font-size: 21px;
}

.app-section-title--level-2 .section-title__icon {
  font-size: 18px;
}

.section-title__text {
  display: block;
  min-width: 0;
  margin: 0;
  color: inherit;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0;
  text-align: left;
}

.app-section-title--level-1 .section-title__text {
  font-size: 20px;
}

.app-section-title--level-2 .section-title__text {
  font-size: 16px;
}
</style>

<template>
  <span class="calendar-today-badge">{{ t('plans.manager.calendarToday') }}</span>
</template>

<script setup>
import { useLocaleStore } from '@/stores/localeStore.js';

const { t } = useLocaleStore();
</script>

<style scoped lang="scss">
/* 月/周视图共用的「今天」角标：主色药丸底、白字，两个视图只负责摆位置。 */
.calendar-today-badge {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--primary-color);
  color: #fff;
  font-size: 10px;
  line-height: 1.5;
}
</style>

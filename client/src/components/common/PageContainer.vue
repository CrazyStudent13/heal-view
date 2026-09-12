<template>
  <section class="page-container">
    <SectionTitle v-if="title" :level="1">
      <template v-if="$slots.icon" #icon><slot name="icon" /></template>
      {{ title }}
      <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    </SectionTitle>
    <div class="page-container__content">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  }
});
</script>

<style scoped lang="scss">
.page-container {
  width: 100%;
  min-height: 100%;
  padding: 20px;
  overflow: auto;
  background: var(--app-bg);
  text-align: left;
}

.page-container__content {
  width: min(100%, 960px);
}

@media (max-width: 640px) {
  .page-container {
    padding: 16px;
  }
}
</style>

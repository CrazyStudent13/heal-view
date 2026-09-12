<template>
  <section
    class="page-container"
    :class="{
      'page-container--full-height': fullHeight,
      'page-container--card': card
    }"
    :style="containerStyle"
  >
    <SectionTitle v-if="title && !card" :level="1">
      <template v-if="$slots.icon" #icon><slot name="icon" /></template>
      {{ title }}
      <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    </SectionTitle>

    <div class="page-container__shell">
      <header v-if="card && (title || $slots.actions || $slots['title-meta'])" class="page-container__header">
        <div class="page-container__title">
          <div class="page-container__title-main">
            <el-icon v-if="$slots.icon" class="page-container__title-icon">
              <slot name="icon" />
            </el-icon>
            <h1>{{ title }}</h1>
          </div>
          <slot name="title-meta" />
        </div>

        <div v-if="$slots.actions" class="page-container__actions">
          <slot name="actions" />
        </div>
      </header>

      <div class="page-container__content">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  card: {
    type: Boolean,
    default: false
  },
  fullHeight: {
    type: Boolean,
    default: false
  },
  contentWidth: {
    type: String,
    default: '960px'
  },
  contentPadding: {
    type: String,
    default: ''
  }
});

const containerStyle = computed(() => ({
  '--page-content-width': props.contentWidth === 'none' ? '100%' : props.contentWidth,
  '--page-content-padding': props.contentPadding || (props.card ? '20px 24px 24px' : '0')
}));
</script>

<style scoped lang="scss">
.page-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  padding: 20px;
  overflow: auto;
  background: var(--app-bg);
  text-align: left;
}

.page-container--full-height {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.page-container__shell {
  display: flex;
  flex-direction: column;
  width: min(100%, var(--page-content-width));
  min-height: 0;
}

.page-container--card .page-container__shell {
  flex: 1;
  overflow: hidden;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(31, 45, 61, 0.04);
}

.page-container__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  gap: 16px;
  min-height: 82px;
  box-sizing: border-box;
  padding: 18px 24px;
  border-bottom: 1px solid var(--card-border);
}

.page-container__title {
  display: flex;
  align-items: baseline;
  min-width: 0;
  gap: 8px;
}

.page-container__title-main {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
}

.page-container__title-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 8px;
  color: var(--primary-color);
  background: var(--primary-light);
  font-size: 20px;
}

.page-container__title h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0;
}

.page-container__actions {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 14px;
}

.page-container__content {
  flex: 1;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
}

.page-container--card .page-container__content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--page-content-padding);
}

:global(.page-surface-card) {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(31, 45, 61, 0.04);
}

:global(.page-surface-header) {
  min-height: 82px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--card-border);
}

@media (max-width: 640px) {
  .page-container {
    padding: 16px;
  }

  .page-container--full-height {
    height: auto;
    min-height: 100%;
    overflow: visible;
  }

  .page-container--card .page-container__shell,
  .page-container--card .page-container__content {
    overflow: visible;
  }

  .page-container__header {
    align-items: flex-start;
    flex-direction: column;
    min-height: 0;
    padding: 16px;
  }

  .page-container__actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .page-container--card .page-container__content {
    padding: 16px;
  }
}
</style>

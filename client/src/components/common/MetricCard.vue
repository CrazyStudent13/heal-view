<template>
  <div
    class="metric-card"
    :class="[
      { 'metric-card--compact': compact },
      `metric-card--${layout}`
    ]"
  >
    <template v-if="layout === 'row'">
      <span v-if="$slots.icon" class="metric-card__icon metric-card__icon--row">
        <slot name="icon" />
      </span>
      <div class="metric-card__content metric-card__content--row">
        <div v-if="$slots.label || $slots.badge" class="metric-card__header metric-card__header--row">
          <div class="metric-card__label-wrap">
            <div class="metric-card__label">
              <slot name="label" />
            </div>
          </div>
          <div v-if="$slots.badge" class="metric-card__badge">
            <slot name="badge" />
          </div>
        </div>

        <div v-if="$slots.value" class="metric-card__value metric-card__value--row">
          <slot name="value" />
        </div>

        <div v-if="$slots.footer" class="metric-card__footer">
          <slot name="footer" />
        </div>
      </div>
    </template>

    <template v-else>
      <div v-if="$slots.label || $slots.badge || $slots.icon" class="metric-card__header">
        <div class="metric-card__label-wrap">
          <span v-if="$slots.icon" class="metric-card__icon">
            <slot name="icon" />
          </span>
          <div class="metric-card__label">
            <slot name="label" />
          </div>
        </div>
        <div v-if="$slots.badge" class="metric-card__badge">
          <slot name="badge" />
        </div>
      </div>

      <div v-if="$slots.value" class="metric-card__value">
        <slot name="value" />
      </div>

      <div v-if="$slots.footer" class="metric-card__footer">
        <slot name="footer" />
      </div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  compact: {
    type: Boolean,
    default: false
  },
  layout: {
    type: String,
    default: 'column',
    validator: value => ['column', 'row'].includes(value)
  }
});
</script>

<style scoped lang="scss">
.metric-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 14px 12px;
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease,
    transform 0.2s ease;
  will-change: transform;
}

.metric-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.metric-card--row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 14px;
  padding: 18px 18px 18px 16px;
}

.metric-card--compact {
  padding: 10px 12px;
}

.metric-card--row.metric-card--compact {
  padding: 18px 18px 18px 16px;
}

.metric-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  min-width: 0;
}

.metric-card--compact .metric-card__header {
  gap: 8px;
  margin-bottom: 4px;
}

.metric-card__label-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.metric-card__icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.metric-card__icon--row {
  width: 56px;
  height: 56px;
  border-radius: 14px;
}

.metric-card__content--row {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 4px;
}

.metric-card__header--row {
  margin-bottom: 0;
  gap: 6px;
}

.metric-card__label {
  min-width: 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-card--compact .metric-card__label {
  font-size: 11px;
}

.metric-card--row .metric-card__label {
  font-size: 13px;
  line-height: 1.2;
}

.metric-card--row.metric-card--compact .metric-card__label {
  font-size: 13px;
}

.metric-card__badge {
  flex: 0 0 auto;
}

.metric-card__value {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  line-height: 1.1;
}

.metric-card--compact .metric-card__value {
  font-size: 18px;
}

.metric-card__value--row {
  font-size: 18px;
  line-height: 1.15;
  width: 100%;
  text-align: left;
}

.metric-card--row.metric-card--compact .metric-card__value--row {
  font-size: 18px;
}

.metric-card__footer {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.35;
}

.metric-card--compact .metric-card__footer {
  margin-top: 3px;
  font-size: 10px;
  line-height: 1.25;
}
</style>


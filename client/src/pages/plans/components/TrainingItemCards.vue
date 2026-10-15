<template>
  <div class="training-items-heading">
    <span>{{ t('plans.manager.trainingItems') }}</span>
    <el-button :icon="Plus" :disabled="!canAdd" @click="emit('add')">
      {{ t('plans.manager.addTrainingItem') }}
    </el-button>
  </div>

  <div class="training-item-cards">
    <div
      v-for="(item, index) in items"
      :key="item.key"
      class="training-item-card"
      :class="{ 'training-item-card--open': isExpanded(item.key) }"
    >
      <div class="training-item-card__header">
        <button
          type="button"
          class="training-item-card__summary"
          :aria-expanded="isExpanded(item.key)"
          :aria-controls="`training-item-body-${item.key}`"
          @click="toggle(item.key)"
        >
          <span class="training-item-card__number">{{ index + 1 }}</span>
          <span class="training-item-card__heading">
            <strong>{{ exerciseFor(item.exerciseId)?.name || t('plans.manager.selectExercise') }}</strong>
            <span>{{ targetsText({ targets: targetPayload(item) }) }}</span>
          </span>
          <el-icon class="training-item-card__arrow"><ArrowRight /></el-icon>
        </button>
        <el-button
          class="training-item-card__delete"
          type="danger"
          text
          :icon="Delete"
          :aria-label="`${t('common.delete')} ${exerciseFor(item.exerciseId)?.name || ''}`"
          @click="emit('remove', index)"
        >
          {{ t('common.delete') }}
        </el-button>
      </div>

      <div v-show="isExpanded(item.key)" :id="`training-item-body-${item.key}`" class="training-item-card__body">
        <div class="training-item-card__exercise">
          <el-form-item :label="t('plans.manager.trainingItems')">
            <el-select
              :model-value="item.exerciseId"
              class="exercise-select"
              filterable
              :placeholder="t('plans.manager.selectExercise')"
              @update:model-value="emit('change-exercise', { item, exerciseId: $event })"
            >
              <el-option
                v-for="exercise in optionsFor(items, item)"
                :key="exercise.id"
                :label="exercise.name"
                :value="exercise.id"
                :disabled="!exercise.enabled"
              />
            </el-select>
          </el-form-item>
        </div>
        <TrainingItemTargets
          :item="item"
          :exercise="exerciseFor(item.exerciseId)"
          variant="card"
          @update="emit('update-target', { item, patch: $event })"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, toRef } from 'vue';
import { ArrowRight, Delete, Plus } from '@element-plus/icons-vue';
import TrainingItemTargets from '@/pages/plans/components/TrainingItemTargets.vue';
import { useTrainingItemEditor } from '@/pages/plans/composables/useTrainingItemEditor.js';
import { useLocaleStore } from '@/stores/localeStore.js';

/**
 * 训练项目的折叠卡片列表：批量加课与训练课编辑两处弹窗共用。
 *
 * 两边的「选动作 → 填目标」操作逻辑本来就完全一样（都走 useTrainingItemEditor），
 * 之前只有呈现方式不同——训练课用可折叠卡片、批量加课用表格。统一成卡片之后，
 * 这份标记与样式只留一处，避免两边各自演化后对不上。
 *
 * 组件本身不持有条目数据，也不直接改 `items` 里的对象：动作选择与目标改动都通过事件
 * 上抛，由调用方落到自己的数组上（与 TrainingItemTargets 的 @update 约定一致）。
 * 展开状态则由调用方通过 v-model:expanded 提供，因为「新增后展开哪一条」属于各页自己的策略。
 */
const props = defineProps({
  items: { type: Array, required: true },
  exercises: { type: Array, default: () => [] },
  /** 已展开条目的 key 列表，由调用方持有。 */
  expanded: { type: Array, default: () => [] }
});
const emit = defineEmits(['add', 'remove', 'update:expanded', 'update-target', 'change-exercise']);

const { t } = useLocaleStore();
const { canAddItem, exerciseFor, optionsFor, targetPayload, targetsText } = useTrainingItemEditor(
  toRef(props, 'exercises')
);

const canAdd = computed(() => canAddItem(props.items));

function isExpanded(key) {
  return props.expanded.includes(key);
}

function toggle(key) {
  emit(
    'update:expanded',
    isExpanded(key) ? props.expanded.filter((itemKey) => itemKey !== key) : [...props.expanded, key]
  );
}
</script>

<style scoped lang="scss">
@use '../styles/itemForm';

.training-item-cards {
  display: grid;
  gap: 12px;
  margin-bottom: 22px;
}

.training-item-card {
  min-width: 0;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  overflow: hidden;
}

.training-item-card__header {
  display: flex;
  align-items: center;
  background: var(--app-bg);
}

.training-item-card__summary {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.training-item-card__summary:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}

.training-item-card__number {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 8px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  font-weight: 600;
}

.training-item-card__heading {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 20px;
  overflow-wrap: anywhere;
}

.training-item-card__heading strong {
  color: var(--text-primary);
  font-size: 14px;
}

.training-item-card__heading > span {
  color: var(--text-secondary);
  font-size: 12px;
}

.training-item-card__arrow {
  flex: none;
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.training-item-card--open .training-item-card__arrow {
  transform: rotate(90deg);
}

.training-item-card__body {
  display: grid;
  grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
  align-items: end;
  gap: 20px;
  padding: 18px;
  border-top: 1px solid var(--card-border);
}

.training-item-card__exercise {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  min-width: 0;
}

.training-item-card__exercise .el-form-item {
  flex: 1;
  max-width: 360px;
  min-width: 0;
  margin-bottom: 0;
}

.training-item-card__delete {
  flex: none;
  margin: 0 10px 0 0;
}

@media (max-width: 1000px) {
  .training-item-card__body {
    grid-template-columns: minmax(0, 1fr);
  }

  /* 目标区由 TrainingItemTargets 渲染，它的根节点会带上本组件的 scope 标记。 */
  .session-card-targets,
  .training-item-card__body > .no-targets {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .training-item-card__delete {
    margin-right: 4px;
    padding-inline: 6px;
  }

  .training-item-card__summary {
    padding: 12px;
  }

  .training-item-card__body {
    padding: 12px;
  }

  .training-item-card__heading {
    flex-direction: column;
    gap: 4px;
  }
}
</style>

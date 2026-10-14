<template>
  <el-dialog
    :model-value="modelValue"
    class="session-dialog"
    :title="dialogTitle"
    width="min(1120px, calc(100vw - 32px))"
    top="6vh"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header="{ titleId, titleClass }">
      <div class="session-dialog-heading">
        <h2 :id="titleId" :class="titleClass">{{ dialogTitle }}</h2>
        <el-select v-model="sessionForm.status" class="session-status-select" :aria-label="t('plans.manager.status')">
          <el-option v-for="status in sessionStatuses" :key="status" :label="statusLabel(status)" :value="status" />
        </el-select>
      </div>
    </template>

    <el-form label-position="top" @submit.prevent>
      <div v-if="!isEditing" class="session-form-grid">
        <el-form-item :label="t('plans.manager.sessionDate')" required>
          <el-date-picker
            v-model="sessionForm.scheduledDate"
            class="full-width"
            type="date"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
      </div>

      <div class="training-items-heading">
        <span>{{ t('plans.manager.trainingItems') }}</span>
        <el-button :icon="Plus" :disabled="!canAddExercise" @click="addSessionItem">{{
          t('plans.manager.addTrainingItem')
        }}</el-button>
      </div>

      <div class="session-item-cards">
        <div
          v-for="(item, index) in sessionForm.items"
          :key="item.key"
          class="session-item-card"
          :class="{ 'session-item-card--open': expandedSessionItems.includes(item.key) }"
        >
          <div class="session-item-card__header">
            <button
              type="button"
              class="session-item-card__summary"
              :aria-expanded="expandedSessionItems.includes(item.key)"
              :aria-controls="`session-item-body-${item.key}`"
              @click="toggleSessionItem(item.key)"
            >
              <span class="session-item-card__number">{{ index + 1 }}</span>
              <span class="session-item-card__heading">
                <strong>{{ exerciseFor(item.exerciseId)?.name || t('plans.manager.selectExercise') }}</strong>
                <span>{{ targetsText({ targets: targetPayload(item) }) }}</span>
              </span>
              <el-icon class="session-item-card__arrow"><ArrowRight /></el-icon>
            </button>
            <el-button
              class="session-item-card__delete"
              type="danger"
              text
              :icon="Delete"
              :aria-label="`${t('common.delete')} ${exerciseFor(item.exerciseId)?.name || ''}`"
              @click="removeSessionItem(index)"
            >
              {{ t('common.delete') }}
            </el-button>
          </div>
          <div
            v-show="expandedSessionItems.includes(item.key)"
            :id="`session-item-body-${item.key}`"
            class="session-item-card__body"
          >
            <div class="session-item-card__exercise">
              <el-form-item :label="t('plans.manager.trainingItems')">
                <el-select
                  v-model="item.exerciseId"
                  class="exercise-select"
                  filterable
                  :placeholder="t('plans.manager.selectExercise')"
                  @change="resetItemTargets(item)"
                >
                  <el-option
                    v-for="exercise in optionsFor(sessionForm.items, item)"
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
              @update="applyTargetUpdate(item, $event)"
            />
          </div>
        </div>
      </div>

      <el-form-item :label="t('plans.manager.sessionNotes')">
        <el-input v-model="sessionForm.notes" type="textarea" :rows="3" maxlength="2000" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="saving" @click="submitSession">{{ t('common.save') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, toRef, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowRight, Delete, Plus } from '@element-plus/icons-vue';
import TrainingItemTargets from '@/pages/plans/components/TrainingItemTargets.vue';
import { SESSION_STATUSES, usePlanLabels } from '@/pages/plans/composables/usePlanLabels.js';
import { useTrainingItemEditor } from '@/pages/plans/composables/useTrainingItemEditor.js';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 已存在的训练课或计划草稿里的训练课；新建时为 null。 */
  session: { type: Object, default: null },
  exercises: { type: Array, default: () => [] },
  /** 点日历某天进来时指定的日期，优先于训练课自身的日期。 */
  scheduledDate: { type: String, default: '' },
  /** 新建时的兜底日期：计划草稿用计划起始日，已有计划用它自己的起始日。 */
  defaultDate: { type: String, default: '' },
  saving: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue', 'submit']);

const { t } = useLocaleStore();
const { statusLabel } = usePlanLabels();
const {
  applyTargetUpdate,
  canAddItem,
  createItem,
  createNextItem,
  exerciseFor,
  optionsFor,
  resetItemTargets,
  targetPayload,
  targetsText
} = useTrainingItemEditor(toRef(props, 'exercises'));

const sessionStatuses = SESSION_STATUSES;
const sessionForm = reactive({ scheduledDate: '', notes: '', status: 'planned', items: [] });
const expandedSessionItems = ref([]);

/** 草稿用 key、已落库的训练课用 id，两者都算「编辑已有内容」。 */
const isEditing = computed(() => Boolean(props.session?.id || props.session?.key));
const dialogTitle = computed(() =>
  isEditing.value
    ? t('plans.manager.editSessionWithDate', { date: sessionForm.scheduledDate })
    : t('plans.manager.addSession')
);
const canAddExercise = computed(() => canAddItem(sessionForm.items));

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) initializeForm();
  },
  { immediate: true }
);

function initializeForm() {
  const session = props.session;
  Object.assign(sessionForm, {
    scheduledDate: props.scheduledDate || session?.scheduledDate || props.defaultDate || '',
    notes: session?.notes || '',
    status: session?.status || 'planned',
    items: session?.items?.map((item) => createItem(item.exerciseId, item.targets)) || []
  });
  if (sessionForm.items.length === 0) addSessionItem();
  expandedSessionItems.value = sessionForm.items.slice(0, 1).map((item) => item.key);
}

function addSessionItem() {
  const item = createNextItem(sessionForm.items);
  if (!item) return;
  sessionForm.items.push(item);
  expandedSessionItems.value.push(item.key);
}

function toggleSessionItem(key) {
  expandedSessionItems.value = expandedSessionItems.value.includes(key)
    ? expandedSessionItems.value.filter((itemKey) => itemKey !== key)
    : [...expandedSessionItems.value, key];
}

function removeSessionItem(index) {
  expandedSessionItems.value = expandedSessionItems.value.filter((key) => key !== sessionForm.items[index].key);
  sessionForm.items.splice(index, 1);
}

/** 只做表单校验并上报；写库还是存草稿由调用方决定。 */
function submitSession() {
  if (!sessionForm.scheduledDate) return ElMessage.warning(t('plans.manager.dateRequired'));
  if (sessionForm.items.length === 0) return ElMessage.warning(t('plans.manager.itemsRequired'));
  if (sessionForm.items.some((item) => !item.exerciseId)) {
    return ElMessage.warning(t('plans.manager.exerciseRequired'));
  }
  emit('submit', {
    scheduledDate: sessionForm.scheduledDate,
    notes: sessionForm.notes,
    status: sessionForm.status,
    items: sessionForm.items.map((item) => ({
      exerciseId: item.exerciseId,
      targets: targetPayload(item)
    }))
  });
}
</script>

<style scoped lang="scss">
@use '../styles/dialogShared';
@use '../styles/itemForm';
@use '../styles/sessionDialogScroll';

.session-dialog-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-right: 28px;
}

.session-dialog-heading h2 {
  margin: 0;
  min-width: 0;
}

.session-status-select {
  flex: 0 0 124px;
}

.session-status-select :deep(.el-select__wrapper) {
  background: transparent;
  box-shadow: none;
}

.session-status-select :deep(.el-select__wrapper:hover) {
  background: var(--app-bg);
}

.session-status-select :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--primary-color);
}

.session-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.session-item-cards {
  display: grid;
  gap: 12px;
  margin-bottom: 22px;
}

.session-item-card {
  min-width: 0;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  overflow: hidden;
}

.session-item-card__header {
  display: flex;
  align-items: center;
  background: var(--app-bg);
}

.session-item-card__summary {
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

.session-item-card__summary:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}

.session-item-card__number {
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

.session-item-card__heading {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 20px;
  overflow-wrap: anywhere;
}

.session-item-card__heading strong {
  color: var(--text-primary);
  font-size: 14px;
}

.session-item-card__heading > span {
  color: var(--text-secondary);
  font-size: 12px;
}

.session-item-card__arrow {
  flex: none;
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.session-item-card--open .session-item-card__arrow {
  transform: rotate(90deg);
}

.session-item-card__body {
  display: grid;
  grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
  align-items: end;
  gap: 20px;
  padding: 18px;
  border-top: 1px solid var(--card-border);
}

.session-item-card__exercise {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  min-width: 0;
}

.session-item-card__exercise .el-form-item {
  flex: 1;
  max-width: 360px;
  min-width: 0;
  margin-bottom: 0;
}

.session-item-card__delete {
  flex: none;
  margin: 0 10px 0 0;
}

@media (max-width: 1000px) {
  .session-item-card__body {
    grid-template-columns: minmax(0, 1fr);
  }

  /* 目标区由子组件渲染，靠父级作用域标记命中它的根节点。 */
  .session-card-targets,
  .session-item-card__body > .no-targets {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .session-dialog-heading {
    align-items: flex-start;
    gap: 4px;
    padding-right: 16px;
  }

  .session-status-select {
    flex-basis: 100px;
  }

  .session-item-card__delete {
    margin-right: 4px;
    padding-inline: 6px;
  }

  .session-item-card__summary {
    padding: 12px;
  }

  .session-item-card__body {
    padding: 12px;
  }

  .session-item-card__heading {
    flex-direction: column;
    gap: 4px;
  }

  .session-form-grid {
    grid-template-columns: 1fr !important;
  }
}
</style>

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

      <TrainingItemCards
        v-model:expanded="expandedSessionItems"
        :items="sessionForm.items"
        :exercises="exercises"
        @add="addSessionItem"
        @remove="removeSessionItem"
        @update-target="applyItemTargetUpdate"
        @change-exercise="applyItemExerciseChange"
      />

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
import TrainingItemCards from '@/pages/plans/components/TrainingItemCards.vue';
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
const { applyTargetUpdate, createItem, createNextItem, resetItemTargets, targetPayload } = useTrainingItemEditor(
  toRef(props, 'exercises')
);

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

/** 换动作后必须重算目标：旧动作的指标对新动作大多不成立。重选同一个动作不动已填的目标。 */
function applyItemExerciseChange({ item, exerciseId }) {
  if (item.exerciseId === exerciseId) return;
  item.exerciseId = exerciseId;
  resetItemTargets(item);
}

function applyItemTargetUpdate({ item, patch }) {
  applyTargetUpdate(item, patch);
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

@media (max-width: 640px) {
  .session-dialog-heading {
    align-items: flex-start;
    gap: 4px;
    padding-right: 16px;
  }

  .session-status-select {
    flex-basis: 100px;
  }

  .session-form-grid {
    grid-template-columns: 1fr !important;
  }
}
</style>

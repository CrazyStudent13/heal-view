<template>
  <section class="exercise-page">
    <header class="exercise-header">
      <div>
        <h2>{{ t('plans.exercise.title') }}</h2>
        <p>{{ t('plans.exercise.pageDescription') }}</p>
      </div>
      <el-button type="primary" @click="openCreate">{{ t('plans.exercise.add') }}</el-button>
    </header>
    <div class="exercise-toolbar">
      <el-input v-model="search" clearable :placeholder="t('plans.exercise.searchPlaceholder')" />
      <el-select v-model="categoryFilter" clearable :placeholder="t('plans.exercise.categoryFilter')">
        <el-option v-for="category in categories" :key="category" :label="categoryLabel(category)" :value="category" />
      </el-select>
      <el-select v-model="statusFilter" :aria-label="t('plans.exercise.statusFilter')">
        <el-option :label="t('plans.exercise.allStatuses')" value="all" />
        <el-option :label="t('plans.exercise.enabled')" value="enabled" />
        <el-option :label="t('plans.exercise.disabled')" value="disabled" />
      </el-select>
      <el-select
        v-model="equipmentFilter"
        class="equipment-filter"
        clearable
        filterable
        :placeholder="t('plans.exercise.equipmentFilter')"
      >
        <el-option
          v-for="option in equipmentFilterOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <div class="exercise-toolbar-actions">
        <el-button type="success" plain :icon="CircleCheck" :disabled="selectedCount === 0" @click="batchEnable">{{
          t('plans.exercise.batchEnable', { count: selectedCount })
        }}</el-button>
        <el-popconfirm
          :title="t('plans.exercise.confirmBatchDisable', { count: selectedCount })"
          :width="240"
          :confirm-button-text="t('plans.exercise.disable')"
          :cancel-button-text="t('common.cancel')"
          @confirm="batchDisable"
        >
          <template #reference
            ><el-button :icon="CircleClose" :disabled="selectedCount === 0">{{
              t('plans.exercise.batchDisable', { count: selectedCount })
            }}</el-button></template
          >
        </el-popconfirm>
        <el-popconfirm
          :title="t('plans.exercise.confirmBatchDelete', { count: selectedCount })"
          :width="240"
          confirm-button-type="danger"
          :confirm-button-text="t('common.delete')"
          :cancel-button-text="t('common.cancel')"
          @confirm="batchDelete"
        >
          <template #reference
            ><el-button type="danger" plain :icon="DeleteIcon" :disabled="selectedCount === 0">{{
              t('plans.exercise.batchDelete', { count: selectedCount })
            }}</el-button></template
          >
        </el-popconfirm>
        <el-tooltip :content="t('common.refresh')" placement="top">
          <el-button
            circle
            :icon="Refresh"
            :loading="loading"
            :aria-label="t('common.refresh')"
            @click="refreshExercises"
          />
        </el-tooltip>
      </div>
    </div>
    <el-alert v-if="error" type="error" :title="error" show-icon :closable="false" class="exercise-alert" />
    <div class="exercise-table-region">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="pagedExercises"
        height="100%"
        class="exercise-table"
        row-key="id"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column :label="t('plans.exercise.name')" min-width="180">
          <template #default="{ row }">
            <el-tooltip :content="row.purpose" :disabled="!row.purpose" placement="top">
              <div class="exercise-name">
                <span class="exercise-icon" :title="iconLabel(row.icon)">
                  <el-icon><component :is="iconComponent(row.icon)" /></el-icon>
                </span>
                <span>{{ row.name }}</span>
              </div>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column :label="t('plans.exercise.category')" width="88"
          ><template #default="{ row }">{{ categoryLabel(row.category) }}</template></el-table-column
        >
        <el-table-column :label="t('plans.exercise.scene')" width="76"
          ><template #default="{ row }">{{ sceneLabel(row.scene) }}</template></el-table-column
        >
        <el-table-column :label="t('plans.exercise.equipmentRequirement')" width="120">
          <template #default="{ row }"
            ><span class="equipment-text">{{ equipmentRequirement(row) }}</span></template
          >
        </el-table-column>
        <el-table-column :label="t('plans.exercise.metrics')" min-width="240"
          ><template #default="{ row }"
            ><el-tag v-for="metric in row.metrics" :key="metric" size="small" class="metric-tag">{{
              metricLabel(metric)
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column :label="t('plans.exercise.verification')" width="110"
          ><template #default="{ row }">{{ verificationLabel(row.verificationMode) }}</template></el-table-column
        >
        <el-table-column :label="t('plans.exercise.status')" width="88"
          ><template #default="{ row }"
            ><el-tag :type="row.enabled ? 'success' : 'info'">{{
              row.enabled ? t('plans.exercise.enabled') : t('plans.exercise.disabled')
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column :label="t('plans.exercise.actions')" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">{{ t('common.edit') }}</el-button>
            <el-popconfirm
              v-if="row.enabled"
              :title="t('plans.exercise.confirmDisable', { name: row.name })"
              :width="220"
              :confirm-button-text="t('plans.exercise.disable')"
              :cancel-button-text="t('common.cancel')"
              @confirm="changeEnabled(row, false)"
            >
              <template #reference
                ><el-button link type="danger">{{ t('plans.exercise.disable') }}</el-button></template
              >
            </el-popconfirm>
            <el-button v-else link type="success" @click="changeEnabled(row, true)">{{
              t('plans.exercise.enable')
            }}</el-button>
            <el-popconfirm
              :title="t('plans.exercise.confirmDelete', { name: row.name })"
              :width="240"
              confirm-button-type="danger"
              :confirm-button-text="t('common.delete')"
              :cancel-button-text="t('common.cancel')"
              @confirm="removeExercise(row)"
            >
              <template #reference
                ><el-button link type="danger">{{ t('common.delete') }}</el-button></template
              >
            </el-popconfirm>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="t('plans.exercise.empty')" /></template>
      </el-table>
    </div>
    <div class="exercise-pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="pageSizes"
        :total="filteredExercises.length"
        layout="total, sizes, prev, pager, next"
        @current-change="handlePageChange"
        @size-change="handlePageSizeChange"
      />
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? t('plans.exercise.edit') : t('plans.exercise.add')"
      width="min(840px, calc(100vw - 32px))"
      top="8vh"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item :label="t('plans.exercise.name')" prop="name">
          <div class="identity-fields">
            <el-select
              v-model="form.icon"
              class="icon-select"
              filterable
              popper-class="exercise-icon-options"
              :aria-label="t('plans.exercise.icon')"
              @change="handleIconChange"
            >
              <template #label="{ value }">
                <el-icon class="selected-icon" :title="iconLabel(value)"
                  ><component :is="iconComponent(value)"
                /></el-icon>
              </template>
              <el-option
                v-for="option in iconOptions"
                :key="option.value"
                :label="t(option.labelKey)"
                :value="option.value"
              >
                <span class="icon-option"
                  ><el-icon><component :is="option.component" /></el-icon><span>{{ t(option.labelKey) }}</span></span
                >
              </el-option>
            </el-select>
            <el-input v-model="form.name" maxlength="80" show-word-limit />
          </div>
        </el-form-item>

        <div class="exercise-form-layout">
          <el-form-item class="category-field" :label="t('plans.exercise.category')" prop="category"
            ><el-select v-model="form.category" class="full-width"
              ><el-option
                v-for="category in categories"
                :key="category"
                :label="categoryLabel(category)"
                :value="category" /></el-select
          ></el-form-item>
          <el-form-item class="verification-field" :label="t('plans.exercise.verification')" prop="verificationMode"
            ><el-select v-model="form.verificationMode" class="full-width"
              ><el-option
                v-for="mode in verificationModes"
                :key="mode"
                :label="verificationLabel(mode)"
                :value="mode" /></el-select
          ></el-form-item>
          <el-form-item class="scene-field" :label="t('plans.exercise.scene')" prop="scene">
            <el-select v-model="form.scene" class="full-width">
              <el-option v-for="scene in scenes" :key="scene" :label="sceneLabel(scene)" :value="scene" />
            </el-select>
          </el-form-item>
          <el-form-item class="equipment-mode-field" :label="t('plans.exercise.equipmentMode')" prop="equipmentMode">
            <el-segmented
              v-model="form.equipmentMode"
              :options="equipmentModeOptions"
              block
              @change="handleEquipmentModeChange"
            />
          </el-form-item>
          <el-form-item
            v-if="form.equipmentMode === 'equipment'"
            class="equipment-field"
            :label="t('plans.exercise.equipmentName')"
            prop="equipment"
          >
            <el-input
              v-model="form.equipment"
              maxlength="80"
              show-word-limit
              :placeholder="t('plans.exercise.equipmentPlaceholder')"
            />
          </el-form-item>
          <el-form-item class="purpose-field" :label="t('plans.exercise.purpose')"
            ><el-input
              v-model="form.purpose"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              :placeholder="t('plans.exercise.purposePlaceholder')"
          /></el-form-item>
          <el-form-item class="metrics-field" :label="t('plans.exercise.metrics')">
            <div class="metric-grid">
              <el-checkbox
                v-for="metric in metrics"
                :key="metric"
                :model-value="form.metrics.includes(metric)"
                @change="(checked) => toggleMetric(metric, checked)"
                >{{ metricLabel(metric) }}</el-checkbox
              >
            </div>
          </el-form-item>
        </div>
      </el-form>
      <template #footer
        ><el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button
        ><el-button type="primary" :loading="saving" @click="save">{{ t('common.save') }}</el-button></template
      >
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { CircleCheck, CircleClose, Delete as DeleteIcon, Refresh } from '@element-plus/icons-vue';
import MdiArmFlex from '@iconify-vue/mdi/arm-flex';
import MdiBadminton from '@iconify-vue/mdi/badminton';
import MdiBasketball from '@iconify-vue/mdi/basketball';
import MdiBike from '@iconify-vue/mdi/bike';
import MdiBoxingGlove from '@iconify-vue/mdi/boxing-glove';
import MdiDumbbell from '@iconify-vue/mdi/dumbbell';
import MdiFitnessCenter from '@iconify-vue/mdi/fitness-center';
import MdiHumanHiking from '@iconify-vue/mdi/human-hiking';
import MdiHumanBarbell from '@iconify-vue/mdi/human-barbell';
import MdiHumanRowing from '@iconify-vue/mdi/human-rowing';
import MdiJumpRope from '@iconify-vue/mdi/jump-rope';
import MdiMeditation from '@iconify-vue/mdi/meditation';
import MdiRun from '@iconify-vue/mdi/run';
import MdiSoccer from '@iconify-vue/mdi/soccer';
import MdiSwim from '@iconify-vue/mdi/swim';
import MdiTableTennis from '@iconify-vue/mdi/table-tennis';
import MdiTennis from '@iconify-vue/mdi/tennis';
import MdiWalk from '@iconify-vue/mdi/walk';
import MdiWeightLifter from '@iconify-vue/mdi/weight-lifter';
import MdiYoga from '@iconify-vue/mdi/yoga';
import { useLocaleStore } from '@/stores/localeStore.js';
import {
  createTrainingExercise,
  deleteTrainingExercise,
  deleteTrainingExercises,
  getTrainingExercises,
  setTrainingExerciseEnabled,
  setTrainingExercisesEnabled,
  updateTrainingExercise
} from '@/api/fitnessApi.js';
import { buildTrainingExercisePayload, updateMetricSelection } from '@/utils/trainingExercise.js';

const { t } = useLocaleStore();
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const exercises = ref([]);
const selectedExercises = ref([]);
const search = ref('');
const categoryFilter = ref('');
const statusFilter = ref('all');
const equipmentFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
const pageSizes = [10, 20, 50];
const dialogVisible = ref(false);
const editingId = ref(null);
const formRef = ref(null);
const tableRef = ref(null);
const categories = ['aerobic', 'strength', 'flexibility', 'balance', 'other'];
const scenes = ['indoor', 'outdoor'];
const verificationModes = ['auto', 'manual', 'mixed'];
const metrics = [
  'duration',
  'distance',
  'sets',
  'repetitions',
  'weight',
  'speed',
  'incline',
  'resistance',
  'heart_rate',
  'calories'
];
const iconOptions = [
  { value: 'mdi:fitness-center', labelKey: 'plans.exercise.icons.general', component: MdiFitnessCenter },
  { value: 'mdi:run', labelKey: 'plans.exercise.icons.running', component: MdiRun },
  { value: 'mdi:walk', labelKey: 'plans.exercise.icons.walking', component: MdiWalk },
  { value: 'mdi:bike', labelKey: 'plans.exercise.icons.cycling', component: MdiBike },
  { value: 'mdi:swim', labelKey: 'plans.exercise.icons.swimming', component: MdiSwim },
  { value: 'mdi:human-rowing', labelKey: 'plans.exercise.icons.rowing', component: MdiHumanRowing },
  { value: 'mdi:dumbbell', labelKey: 'plans.exercise.icons.dumbbell', component: MdiDumbbell },
  { value: 'mdi:weight-lifter', labelKey: 'plans.exercise.icons.weightLifting', component: MdiWeightLifter },
  { value: 'mdi:human-barbell', labelKey: 'plans.exercise.icons.machineStrength', component: MdiHumanBarbell },
  { value: 'mdi:arm-flex', labelKey: 'plans.exercise.icons.bodyweight', component: MdiArmFlex },
  { value: 'mdi:yoga', labelKey: 'plans.exercise.icons.yoga', component: MdiYoga },
  { value: 'mdi:meditation', labelKey: 'plans.exercise.icons.meditation', component: MdiMeditation },
  { value: 'mdi:jump-rope', labelKey: 'plans.exercise.icons.jumpRope', component: MdiJumpRope },
  { value: 'mdi:human-hiking', labelKey: 'plans.exercise.icons.hiking', component: MdiHumanHiking },
  { value: 'mdi:basketball', labelKey: 'plans.exercise.icons.basketball', component: MdiBasketball },
  { value: 'mdi:soccer', labelKey: 'plans.exercise.icons.soccer', component: MdiSoccer },
  { value: 'mdi:tennis', labelKey: 'plans.exercise.icons.tennis', component: MdiTennis },
  { value: 'mdi:badminton', labelKey: 'plans.exercise.icons.badminton', component: MdiBadminton },
  { value: 'mdi:table-tennis', labelKey: 'plans.exercise.icons.tableTennis', component: MdiTableTennis },
  { value: 'mdi:boxing-glove', labelKey: 'plans.exercise.icons.boxing', component: MdiBoxingGlove }
];
const iconComponents = Object.fromEntries(iconOptions.map((option) => [option.value, option.component]));
const iconLabels = Object.fromEntries(iconOptions.map((option) => [option.value, option.labelKey]));
const defaultIcon = 'mdi:fitness-center';
const form = reactive({
  name: '',
  icon: defaultIcon,
  category: 'aerobic',
  scene: 'indoor',
  verificationMode: 'manual',
  equipmentMode: 'bodyweight',
  equipment: '',
  metrics: [],
  purpose: ''
});
const autoFilledName = ref('');
const equipmentModeOptions = computed(() => [
  { label: t('plans.exercise.equipmentModes.bodyweight'), value: 'bodyweight' },
  { label: t('plans.exercise.equipmentModes.equipment'), value: 'equipment' }
]);
const validateEquipment = (_rule, value, callback) => {
  if (form.equipmentMode === 'equipment' && !String(value || '').trim())
    callback(new Error(t('plans.exercise.equipmentRequired')));
  else callback();
};
const rules = {
  name: [{ required: true, message: t('plans.exercise.nameRequired'), trigger: 'blur' }],
  scene: [{ required: true, message: t('plans.exercise.sceneRequired'), trigger: 'change' }],
  equipment: [{ validator: validateEquipment, trigger: 'blur' }]
};
const selectedCount = computed(() => selectedExercises.value.length);
const equipmentFilterOptions = computed(() => {
  const equipmentNames = [
    ...new Set(
      exercises.value
        .filter((exercise) => exercise.equipmentMode === 'equipment' && exercise.equipment)
        .map((exercise) => exercise.equipment)
    )
  ].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return [
    { label: t('plans.exercise.equipmentModes.bodyweight'), value: 'bodyweight' },
    { label: t('plans.exercise.allEquipment'), value: 'equipment' },
    ...equipmentNames.map((equipment) => ({ label: equipment, value: `equipment:${equipment}` }))
  ];
});
const filteredExercises = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase();
  return exercises.value.filter((exercise) => {
    const matchesEquipment =
      !equipmentFilter.value ||
      (equipmentFilter.value === 'bodyweight' && exercise.equipmentMode === 'bodyweight') ||
      (equipmentFilter.value === 'equipment' && exercise.equipmentMode === 'equipment') ||
      (equipmentFilter.value.startsWith('equipment:') &&
        exercise.equipment === equipmentFilter.value.slice('equipment:'.length));
    return (
      (!keyword ||
        exercise.name.toLocaleLowerCase().includes(keyword) ||
        exercise.purpose.toLocaleLowerCase().includes(keyword) ||
        (exercise.equipment || '').toLocaleLowerCase().includes(keyword)) &&
      matchesEquipment &&
      (!categoryFilter.value || exercise.category === categoryFilter.value) &&
      (statusFilter.value === 'all' || (statusFilter.value === 'enabled' ? exercise.enabled : !exercise.enabled))
    );
  });
});
const pagedExercises = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredExercises.value.slice(start, start + pageSize.value);
});
const categoryLabel = (value) => t(`plans.exercise.categories.${value}`);
const sceneLabel = (value) => t(`plans.exercise.scenes.${value}`);
const verificationLabel = (value) => t(`plans.exercise.verificationModes.${value}`);
const metricLabel = (value) => t(`plans.exercise.metricOptions.${value}`);
const equipmentRequirement = (exercise) =>
  exercise.equipmentMode === 'equipment' ? exercise.equipment : t('plans.exercise.equipmentModes.bodyweight');
const iconComponent = (value) => iconComponents[value] || MdiFitnessCenter;
const iconLabel = (value) => t(iconLabels[value] || 'plans.exercise.icons.general');
async function loadExercises() {
  loading.value = true;
  error.value = '';
  try {
    const response = await getTrainingExercises();
    exercises.value = response.exercises || [];
  } catch (requestError) {
    error.value = requestError.message || t('plans.exercise.loadFailed');
  } finally {
    loading.value = false;
  }
}
function handleSelectionChange(rows) {
  selectedExercises.value = rows;
}
function clearSelection() {
  tableRef.value?.clearSelection();
  selectedExercises.value = [];
}
function handlePageChange() {
  clearSelection();
}
function handlePageSizeChange() {
  currentPage.value = 1;
  clearSelection();
}
async function refreshExercises() {
  clearSelection();
  await loadExercises();
}
function resetForm() {
  autoFilledName.value = '';
  Object.assign(form, {
    name: '',
    icon: defaultIcon,
    category: 'aerobic',
    scene: 'indoor',
    verificationMode: 'manual',
    equipmentMode: 'bodyweight',
    equipment: '',
    metrics: [],
    purpose: ''
  });
}
function handleIconChange(value) {
  if (!form.name.trim() || form.name === autoFilledName.value) {
    const suggestedName = iconLabel(value);
    form.name = suggestedName;
    autoFilledName.value = suggestedName;
  }
}
function handleEquipmentModeChange(value) {
  if (value === 'bodyweight') form.equipment = '';
}
function toggleMetric(metric, checked) {
  form.metrics = updateMetricSelection(form.metrics, metric, checked);
}
function openCreate() {
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
}
function openEdit(exercise) {
  editingId.value = exercise.id;
  autoFilledName.value = '';
  Object.assign(form, {
    name: exercise.name,
    icon: exercise.icon,
    category: exercise.category,
    scene: exercise.scene,
    verificationMode: exercise.verificationMode,
    equipmentMode: exercise.equipmentMode || 'bodyweight',
    equipment: exercise.equipment || '',
    metrics: Array.isArray(exercise.metrics) ? [...exercise.metrics] : [],
    purpose: exercise.purpose
  });
  dialogVisible.value = true;
}
async function save() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  const payload = buildTrainingExercisePayload(form);
  saving.value = true;
  try {
    if (editingId.value) await updateTrainingExercise(editingId.value, payload);
    else await createTrainingExercise(payload);
    dialogVisible.value = false;
    ElMessage.success(t('plans.exercise.saved'));
    await loadExercises();
  } catch (requestError) {
    ElMessage.error(requestError.message || t('plans.exercise.saveFailed'));
  } finally {
    saving.value = false;
  }
}
async function changeEnabled(exercise, enabled) {
  try {
    const updatedExercise = await setTrainingExerciseEnabled(exercise.id, enabled);
    const index = exercises.value.findIndex((item) => item.id === exercise.id);
    if (index >= 0) exercises.value[index] = updatedExercise;
    ElMessage.success(t(enabled ? 'plans.exercise.enabledSuccessfully' : 'plans.exercise.disabledSuccessfully'));
  } catch (requestError) {
    ElMessage.error(requestError.message || t('plans.exercise.statusUpdateFailed'));
  }
}
async function removeExercise(exercise) {
  try {
    await deleteTrainingExercise(exercise.id);
    exercises.value = exercises.value.filter((item) => item.id !== exercise.id);
    ElMessage.success(t('plans.exercise.deletedSuccessfully'));
  } catch (requestError) {
    ElMessage.error(
      t(requestError.code === 'TRAINING_EXERCISE_IN_USE' ? 'plans.exercise.deleteInUse' : 'plans.exercise.deleteFailed')
    );
  }
}
async function batchEnable() {
  const ids = selectedExercises.value.map((exercise) => exercise.id);
  if (ids.length === 0) return;
  try {
    await setTrainingExercisesEnabled(ids, true);
    ElMessage.success(t('plans.exercise.batchEnabledSuccessfully', { count: ids.length }));
    await loadExercises();
    clearSelection();
  } catch (requestError) {
    ElMessage.error(requestError.message || t('plans.exercise.batchUpdateFailed'));
  }
}
async function batchDisable() {
  const ids = selectedExercises.value.map((exercise) => exercise.id);
  if (ids.length === 0) return;
  try {
    await setTrainingExercisesEnabled(ids, false);
    ElMessage.success(t('plans.exercise.batchDisabledSuccessfully', { count: ids.length }));
    await loadExercises();
    clearSelection();
  } catch (requestError) {
    ElMessage.error(requestError.message || t('plans.exercise.batchUpdateFailed'));
  }
}
async function batchDelete() {
  const ids = selectedExercises.value.map((exercise) => exercise.id);
  if (ids.length === 0) return;
  try {
    const result = await deleteTrainingExercises(ids);
    ElMessage.success(t('plans.exercise.batchDeletedSuccessfully', { count: result.deletedIds.length }));
    await loadExercises();
    clearSelection();
  } catch (requestError) {
    ElMessage.error(
      t(
        requestError.code === 'TRAINING_EXERCISE_IN_USE'
          ? 'plans.exercise.batchDeleteInUse'
          : 'plans.exercise.batchDeleteFailed'
      )
    );
  }
}
watch([search, categoryFilter, statusFilter, equipmentFilter], () => {
  currentPage.value = 1;
  clearSelection();
});
watch(
  () => filteredExercises.value.length,
  (total) => {
    const lastPage = Math.max(1, Math.ceil(total / pageSize.value));
    if (currentPage.value > lastPage) currentPage.value = lastPage;
  }
);
onMounted(loadExercises);
</script>

<style scoped lang="scss">
.exercise-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.exercise-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--card-border);
}
.exercise-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 22px;
  letter-spacing: 0;
}
.exercise-header p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}
.exercise-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.exercise-toolbar .el-input {
  width: 200px;
}
.exercise-toolbar .el-select {
  width: 145px;
}
.exercise-toolbar .equipment-filter {
  width: 170px;
}
.exercise-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.exercise-alert {
  margin-bottom: 16px;
}
.exercise-table-region {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
.exercise-table {
  width: 100%;
  height: 100%;
}
.exercise-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  overflow-x: auto;
}
.exercise-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--text-primary);
  font-weight: 500;
}
.exercise-icon {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: var(--primary-color);
  background: var(--primary-light);
  font-size: 18px;
}
.equipment-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.icon-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.selected-icon {
  color: var(--primary-color);
  font-size: 18px;
}
.metric-tag {
  margin: 2px 4px 2px 0;
}
.identity-fields {
  display: flex;
  width: 100%;
  gap: 10px;
}
.identity-fields .el-input {
  flex: 1;
  min-width: 0;
}
.icon-select {
  width: 76px;
  flex: 0 0 76px;
}
.icon-select :deep(.el-select__selected-item) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.exercise-form-layout {
  display: grid;
  grid-template-areas: 'category verification scene' 'equipment-mode equipment equipment' 'purpose purpose purpose' 'metrics metrics metrics';
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 18px;
  align-items: start;
}
.category-field {
  grid-area: category;
}
.verification-field {
  grid-area: verification;
}
.scene-field {
  grid-area: scene;
}
.equipment-mode-field {
  grid-area: equipment-mode;
}
.equipment-field {
  grid-area: equipment;
}
.purpose-field {
  grid-area: purpose;
}
.metrics-field {
  grid-area: metrics;
}
.full-width {
  width: 100%;
}
.metrics-field {
  margin-bottom: 0;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px 12px;
}
@media (max-width: 700px) {
  .exercise-page {
    height: auto;
    min-height: 100%;
    overflow: visible;
  }
  .exercise-header {
    align-items: stretch;
    flex-direction: column;
  }
  .exercise-header .el-button {
    align-self: flex-start;
  }
  .exercise-toolbar {
    display: block;
  }
  .exercise-toolbar > * {
    margin-bottom: 10px;
    width: 100%;
    max-width: none !important;
  }
  .exercise-toolbar-actions {
    display: flex;
    flex-wrap: wrap;
    margin-left: 0;
  }
  .exercise-toolbar-actions .el-button {
    width: auto;
  }
  .exercise-table-region {
    flex: none;
    height: 60vh;
    min-height: 360px;
  }
  .exercise-pagination {
    justify-content: flex-start;
  }
  .identity-fields {
    flex-direction: column;
  }
  .icon-select {
    width: 100%;
    flex-basis: auto;
  }
  .exercise-form-layout {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .exercise-form-layout > .el-form-item {
    width: 100%;
  }
  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

<style lang="scss">
.exercise-icon-options {
  min-width: 210px !important;
}
</style>

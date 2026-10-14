import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useLocaleStore } from '@/stores/localeStore.js';
import { normalizeRequestError } from '@/utils/requestState.js';
import {
  createTrainingPhase,
  createTrainingPlan,
  createTrainingPlanWithSessions,
  createTrainingSession,
  createTrainingSessionsBatch,
  deleteTrainingPlan,
  deleteTrainingSession,
  getWeightData,
  getTrainingExercises,
  getTrainingPlan,
  getTrainingPlans,
  saveTrainingPhaseReview,
  setTrainingPlanArchived,
  updateTrainingPhase,
  updateTrainingPlan,
  updateTrainingSession
} from '@/api/fitnessApi.js';

/**
 * 计划总览页的数据与交互。
 *
 * 页面只负责把这里返回的状态接到组件上：列表、详情、弹窗的读写请求都留在这里。
 * 弹窗和抽屉只上报「用户做了什么」（载荷或事件），成功后由这里刷新列表或详情，
 * 错误提示、特殊错误码（例如计划开始后不能缩短结束日期）也统一在这里处理。
 */
export function usePlanWorkspace() {
  const { t } = useLocaleStore();
  const route = useRoute();
  const router = useRouter();

  const loading = ref(false);
  const error = ref('');
  const plans = ref([]);
  const exercises = ref([]);
  const selectedPlanId = ref(null);
  const showArchived = ref(false);
  const planDetail = ref(null);
  const planWeightData = ref(null);
  const detailDrawerVisible = ref(false);
  const detailLoading = ref(false);
  const saving = ref(false);
  const archivingPlan = ref(false);
  const updatingPhaseStatus = ref(false);

  // 弹窗只保留「打开哪一个、编辑哪一条」这类最小状态：表单内容留在各自的弹窗组件里。
  const planDialogVisible = ref(false);
  const editingPlan = ref(null);
  const sessionDialogVisible = ref(false);
  const sessionDialogSession = ref(null);
  const sessionDialogDate = ref('');
  const batchSessionDialogVisible = ref(false);
  const phaseReviewDialogVisible = ref(false);
  const reviewPhase = ref(null);

  async function loadPlanDetail(id) {
    if (!id) {
      planDetail.value = null;
      planWeightData.value = null;
      return;
    }
    detailLoading.value = true;
    try {
      const loadedPlan = await getTrainingPlan(id);
      planDetail.value = loadedPlan;
      try {
        planWeightData.value = await getWeightData({
          startDate: loadedPlan.startDate,
          endDate: loadedPlan.endDate
        });
      } catch {
        planWeightData.value = null;
      }
    } catch (requestError) {
      planWeightData.value = null;
      error.value = normalizeRequestError(requestError, t) || t('plans.manager.loadFailed');
    } finally {
      detailLoading.value = false;
    }
  }

  async function loadPlans(preferredId = selectedPlanId.value, includeArchived = showArchived.value) {
    // 服务端已经按「已归档最后 → active → draft → ended → startDate 倒序 → id 倒序」排好，
    // 客户端不再重排，避免两套排序规则各自漂移。
    const response = await getTrainingPlans(includeArchived ? { includeArchived: true } : {});
    plans.value = response.plans;
    const nextId = plans.value.some((plan) => plan.id === preferredId) ? preferredId : plans.value[0]?.id || null;
    selectedPlanId.value = nextId;
    await loadPlanDetail(nextId);
  }

  async function loadWorkspace() {
    loading.value = true;
    error.value = '';
    try {
      const exerciseResponse = await getTrainingExercises();
      exercises.value = exerciseResponse.exercises;
      const requestedPlanId = Number(route.query.planId);
      await loadPlans(Number.isInteger(requestedPlanId) && requestedPlanId > 0 ? requestedPlanId : null);
      // 带 ?planId= 进来时直接把详情抽屉打开，手机端和外部链接都靠它落到具体计划。
      detailDrawerVisible.value = Number.isInteger(requestedPlanId) && selectedPlanId.value === requestedPlanId;
    } catch (requestError) {
      error.value = normalizeRequestError(requestError, t) || t('plans.manager.loadFailed');
    } finally {
      loading.value = false;
    }
  }

  async function selectPlan(id) {
    if (id === selectedPlanId.value) {
      if (planDetail.value) detailDrawerVisible.value = true;
      return;
    }
    selectedPlanId.value = id;
    error.value = '';
    await loadPlanDetail(id);
    if (planDetail.value) detailDrawerVisible.value = true;
  }

  function openPlanDialog(plan = null) {
    editingPlan.value = plan;
    planDialogVisible.value = true;
  }

  function openSessionDialog(session = null, scheduledDate = '') {
    sessionDialogSession.value = session;
    sessionDialogDate.value = scheduledDate;
    sessionDialogVisible.value = true;
  }

  function openBatchSessionDialog() {
    if (!planDetail.value) return;
    batchSessionDialogVisible.value = true;
  }

  function openPlanReviewDialog(phase) {
    if (!phase) return;
    reviewPhase.value = phase;
    phaseReviewDialogVisible.value = true;
  }

  /** 跳到手机端训练页的对应日期补卡：手机端已经支持 ?date=，这里只负责带过去。 */
  function openMobileBackfill(date) {
    if (!date) return;
    router.push({ name: 'mobile-today', query: { date } });
  }

  async function savePlanRequest({ type, planId, plan, phaseName, sessions }) {
    saving.value = true;
    try {
      let saved;
      if (type === 'update') saved = await updateTrainingPlan(planId, plan);
      else if (type === 'create') saved = await createTrainingPlan(plan);
      else saved = await createTrainingPlanWithSessions({ plan, sessions });
      await syncPlanPhase(saved.id, phaseName, plan, type === 'update' ? planDetail.value?.phases?.[0] || null : null);
      planDialogVisible.value = false;
      await loadPlans(saved.id);
      detailDrawerVisible.value = true;
      ElMessage.success(t('plans.manager.saved'));
    } catch (requestError) {
      // 计划一旦开始，缩短结束日期会被服务端拒绝（409）。这是产品规则而不是故障，
      // 所以翻成人话告诉用户三条可行的替代路径，不要把原始报文丢给用户。
      if (requestError?.code === 'PLAN_END_DATE_CANNOT_SHRINK') {
        ElMessage.warning(t('plans.manager.adherence.endDateLocked'));
      } else {
        ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.saveFailed'));
      }
    } finally {
      saving.value = false;
    }
  }

  async function syncPlanPhase(planId, phaseName, plan, existingPhase = null) {
    const name = (phaseName || '').trim();
    if (!name) return;
    const payload = {
      name,
      startDate: plan.startDate,
      endDate: plan.endDate,
      status: existingPhase?.status || 'planned',
      description: existingPhase?.description || '',
      adjustmentReason: existingPhase?.adjustmentReason || ''
    };
    if (existingPhase?.id) await updateTrainingPhase(existingPhase.id, payload);
    else await createTrainingPhase(planId, payload);
  }

  async function saveSession(payload) {
    saving.value = true;
    try {
      if (sessionDialogSession.value?.id) await updateTrainingSession(sessionDialogSession.value.id, payload);
      else await createTrainingSession(planDetail.value.id, payload);
      sessionDialogVisible.value = false;
      await loadPlans(planDetail.value.id);
      ElMessage.success(t('plans.manager.saved'));
    } catch (requestError) {
      ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.saveFailed'));
    } finally {
      saving.value = false;
    }
  }

  async function saveBatchSessions({ dates, notes, status, items }) {
    saving.value = true;
    try {
      const response = await createTrainingSessionsBatch(
        planDetail.value.id,
        dates.map((scheduledDate) => ({ scheduledDate, notes, status, items }))
      );
      batchSessionDialogVisible.value = false;
      await loadPlans(planDetail.value.id);
      const generatedCount = Number(response?.createdCount || 0);
      const appendedCount = Number(response?.updatedCount || 0);
      if (generatedCount > 0 && appendedCount > 0) {
        ElMessage.success(t('plans.manager.batchMixed', { generated: generatedCount, appended: appendedCount }));
      } else if (appendedCount > 0) {
        ElMessage.success(t('plans.manager.batchAppended', { count: appendedCount }));
      } else {
        ElMessage.success(t('plans.manager.batchGenerated', { count: generatedCount }));
      }
    } catch (requestError) {
      ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.saveFailed'));
    } finally {
      saving.value = false;
    }
  }

  async function savePhaseReview(review) {
    saving.value = true;
    try {
      await saveTrainingPhaseReview(review.phaseId, {
        summary: review.summary,
        fatigueLevel: review.fatigueLevel,
        discomfort: review.discomfort,
        adjustment: review.adjustment
      });
      phaseReviewDialogVisible.value = false;
      await loadPlanDetail(planDetail.value?.id);
      ElMessage.success(t('plans.manager.reviewSaved'));
    } catch (requestError) {
      ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.saveFailed'));
    } finally {
      saving.value = false;
    }
  }

  async function togglePlanArchived(plan) {
    if (!plan) return;
    const nextArchived = !plan.archived;
    archivingPlan.value = true;
    try {
      await setTrainingPlanArchived(plan.id, nextArchived);
      // 归档会改变列表的可见性，成功后重新拉一次列表，让开关和列表保持一致。
      await loadPlans(plan.id);
      // 取消「显示已归档」时，刚归档的计划已经从列表里消失，选中项会落到别的计划上；
      // 这种情况下把详情重新指回被操作的计划，用户才看得到自己刚做了什么。
      if (selectedPlanId.value !== plan.id) {
        selectedPlanId.value = plan.id;
        await loadPlanDetail(plan.id);
      }
      ElMessage.success(t(nextArchived ? 'plans.manager.archive' : 'plans.manager.unarchive'));
    } catch (requestError) {
      ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.archiveFailed'));
    } finally {
      archivingPlan.value = false;
    }
  }

  /**
   * 取消 / 恢复阶段。
   *
   * 这是"计划开始后只能延长"的配套逃生口：达成度的分母会排除被 cancelled 阶段覆盖的训练日，
   * 所以因为手术或身体状态提前结束的阶段不会倒扣分。其余阶段状态（planned/active/paused/completed）
   * 目前不参与任何计算，所以这里只暴露这一个真正有作用的动作，而不是一个五选一的下拉。
   */
  async function togglePhaseCancelled(phase) {
    if (!phase?.id) return;
    const planId = planDetail.value?.id;
    const nextStatus = phase.status === 'cancelled' ? 'planned' : 'cancelled';
    updatingPhaseStatus.value = true;
    try {
      await updateTrainingPhase(phase.id, {
        name: phase.name,
        startDate: phase.startDate,
        endDate: phase.endDate,
        description: phase.description || '',
        adjustmentReason: phase.adjustmentReason || '',
        status: nextStatus
      });
      if (planId) {
        await Promise.all([loadPlanDetail(planId), loadPlans(planId, showArchived.value)]);
      }
      ElMessage.success(t(nextStatus === 'cancelled' ? 'plans.manager.cancelPhase' : 'plans.manager.restorePhase'));
    } catch (requestError) {
      ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.loadFailed'));
    } finally {
      updatingPhaseStatus.value = false;
    }
  }

  async function removePlan(plan) {
    try {
      await deleteTrainingPlan(plan.id);
      detailDrawerVisible.value = false;
      selectedPlanId.value = null;
      planDetail.value = null;
      await loadPlans();
      ElMessage.success(t('plans.manager.planDeleted'));
    } catch (requestError) {
      ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.deleteFailed'));
    }
  }

  async function removeSession(session) {
    try {
      await deleteTrainingSession(session.id);
      await loadPlans(planDetail.value.id);
      ElMessage.success(t('plans.manager.sessionDeleted'));
    } catch (requestError) {
      ElMessage.error(normalizeRequestError(requestError, t) || t('plans.manager.deleteFailed'));
    }
  }

  watch(showArchived, () => {
    loadPlans(selectedPlanId.value).catch((requestError) => {
      error.value = normalizeRequestError(requestError, t) || t('plans.manager.loadFailed');
    });
  });

  onMounted(loadWorkspace);

  return {
    archivingPlan,
    batchSessionDialogVisible,
    detailDrawerVisible,
    detailLoading,
    editingPlan,
    error,
    exercises,
    loading,
    phaseReviewDialogVisible,
    planDialogVisible,
    planDetail,
    planWeightData,
    plans,
    reviewPhase,
    saving,
    selectedPlanId,
    sessionDialogDate,
    sessionDialogSession,
    sessionDialogVisible,
    showArchived,
    updatingPhaseStatus,
    openBatchSessionDialog,
    openMobileBackfill,
    openPlanDialog,
    openPlanReviewDialog,
    openSessionDialog,
    removePlan,
    removeSession,
    saveBatchSessions,
    savePhaseReview,
    savePlanRequest,
    saveSession,
    selectPlan,
    togglePhaseCancelled,
    togglePlanArchived
  };
}

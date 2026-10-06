<template>
  <div class="mobile-training">
    <header class="mobile-training__dates">
      <button type="button" class="date-step" :aria-label="t('mobile.previousDay')" @click="shiftDate(-1)">
        <van-icon name="arrow-left" />
      </button>
      <div class="date-current">
        <strong>{{ dateLabel }}</strong>
        <small
          v-if="!isToday"
          class="date-current__back"
          role="button"
          tabindex="0"
          @click="goToday"
          @keydown.enter="goToday"
        >
          {{ t('mobile.backToToday') }}
        </small>
      </div>
      <button
        type="button"
        class="date-step"
        :disabled="isToday"
        :aria-label="t('mobile.nextDay')"
        @click="shiftDate(1)"
      >
        <van-icon name="arrow" />
      </button>
    </header>

    <div class="mobile-training__body">
      <div v-if="error" class="training-error" role="alert">
        <van-icon name="warning-o" />
        <span>{{ error }}</span>
      </div>

      <div v-if="loading" class="mobile-training__loading">
        <van-skeleton title :row="6" />
      </div>

      <div v-else-if="sessions.length === 0" class="training-empty">
        <van-icon name="records" class="training-empty__icon" />
        <p>{{ t('mobile.noSessions') }}</p>
      </div>

      <template v-else>
        <section v-for="session in sessions" :key="session.sessionId" class="session-block">
          <header class="session-block__header">
            <div class="session-block__title">
              <h2>{{ session.name || session.planName }}</h2>
              <p>
                {{ session.planName }}
                <span v-if="session.sequence > 1"> · #{{ session.sequence }}</span>
              </p>
            </div>
            <van-tag v-if="session.itemCount > 0" :type="statusTagType(session)" size="medium">
              {{ statusLabel(session) }}
            </van-tag>
          </header>

          <div v-if="session.itemCount > 0" class="session-block__summary">
            <span>{{
              t('mobile.sessionProgress', { done: sessionDoneCount(session), total: session.itemCount })
            }}</span>
            <span v-if="session.autoItemCount > 0" class="session-block__automatic">
              {{ t('mobile.automaticHint', { count: session.autoItemCount }) }}
            </span>
          </div>

          <p v-if="session.planNotes" class="session-block__notes">{{ session.planNotes }}</p>

          <!-- 全部由手表自动确认的日子：说明情况，但不出现在待确认流程里 -->
          <div v-if="session.itemCount === 0" class="session-block__auto">
            <van-icon name="clock-o" class="session-block__auto-icon" />
            <p>{{ t('mobile.allAutomaticNotice', { count: session.autoItemCount }) }}</p>
          </div>

          <template v-else>
            <div class="session-items">
              <TrainingItemPanel
                v-for="item in session.items"
                :key="item.sessionItemId"
                :item="item"
                :actuals="itemDraft(session.sessionId, item.sessionItemId).actuals"
                :skip-reason="itemDraft(session.sessionId, item.sessionItemId).skipReason"
                :note="itemDraft(session.sessionId, item.sessionItemId).note"
                :details-open="isDetailsOpen(session.sessionId, item.sessionItemId)"
                @update="(patch) => updateItem(session.sessionId, item.sessionItemId, patch)"
                @set-complete="(complete) => setItemComplete(session.sessionId, item.sessionItemId, complete)"
                @toggle-details="toggleDetails(session.sessionId, item.sessionItemId)"
              />
            </div>

            <van-collapse v-model="sessionDraft(session.sessionId).extrasOpen" class="session-block__extras">
              <van-collapse-item :title="t('mobile.moreFeedback')" name="feedback">
                <div class="session-block__feel">
                  <span class="session-block__feel-label">{{ t('mobile.sessionFeel') }}</span>
                  <van-radio-group
                    :model-value="sessionDraft(session.sessionId).feel"
                    direction="horizontal"
                    @update:model-value="(value) => updateSession(session.sessionId, { feel: value })"
                  >
                    <van-radio v-for="feel in sessionFeels" :key="feel" :name="feel" icon-size="18px">
                      {{ t(`mobile.feels.${feel}`) }}
                    </van-radio>
                  </van-radio-group>
                </div>

                <van-field
                  :model-value="sessionDraft(session.sessionId).discomfort"
                  class="session-block__discomfort"
                  type="textarea"
                  rows="2"
                  autosize
                  maxlength="2000"
                  :label="t('mobile.discomfortLabel')"
                  :placeholder="t('mobile.discomfortPlaceholder')"
                  @update:model-value="(value) => updateSession(session.sessionId, { discomfort: value })"
                />
              </van-collapse-item>
            </van-collapse>
          </template>
        </section>
      </template>
    </div>

    <footer v-if="!loading && confirmableSessions.length > 0" class="mobile-training__footer">
      <span class="mobile-training__progress">
        {{ t('mobile.progress', { done: totalDone, total: totalManual }) }}
      </span>
      <van-button
        type="primary"
        class="mobile-training__save"
        :loading="savingSessionId !== null"
        loading-text=""
        @click="submitAll"
      >
        {{ t('mobile.saveRecord') }}
      </van-button>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showFailToast, showSuccessToast, showToast } from 'vant';
import { useLocaleStore } from '@/stores/localeStore.js';
import { getTrainingExecution, saveTrainingSessionExecution } from '@/api/fitnessApi.js';
import { normalizeRequestError } from '@/utils/requestState.js';
import TrainingItemPanel from '@/pages/mobile/components/TrainingItemPanel.vue';

const { t, currentLocale } = useLocaleStore();
const route = useRoute();
const router = useRouter();

const LAST_DATE_KEY = 'heal-view-mobile-last-date';
const DRAFT_PREFIX = 'heal-view-mobile-draft:';
const sessionFeels = ['easy', 'normal', 'hard'];

const sessions = ref([]);
const loading = ref(true);
const error = ref('');
const savingSessionId = ref(null);
// 只展开用户正在补充详细数据的项目，默认保持紧凑的快速打卡列表。
const expandedItems = reactive({});
// 草稿在数据加载后一次性建好，避免在渲染期间创建响应式状态。
const drafts = reactive({});

const isToday = computed(() => selectedDate.value === todayString());

const selectedDate = computed(() => {
  const value = route.query.date;
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayString();
});

const dateLabel = computed(() => {
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const formatted = new Intl.DateTimeFormat(currentLocale.value, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC'
  }).format(date);
  return isToday.value ? t('mobile.todayWithDate', { date: formatted }) : formatted;
});

// 只有需要人工确认的训练单元才参与底部进度与保存。
const confirmableSessions = computed(() => sessions.value.filter((session) => session.itemCount > 0));
const totalManual = computed(() => confirmableSessions.value.reduce((sum, session) => sum + session.itemCount, 0));
const totalDone = computed(() =>
  confirmableSessions.value.reduce((sum, session) => sum + sessionDoneCount(session), 0)
);

function todayString() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join(
    '-'
  );
}

function draftKey(sessionId) {
  return `${DRAFT_PREFIX}${selectedDate.value}:${sessionId}`;
}

function sessionDraft(sessionId) {
  return drafts[sessionId] || { items: {}, feel: '', discomfort: '', kicked: false, extrasOpen: [] };
}

function itemDraft(sessionId, sessionItemId) {
  return sessionDraft(sessionId).items?.[sessionItemId] || { actuals: {}, skipReason: '', note: '' };
}

/**
 * 逐项完成度：组数目标决定「做了几组算完成几成」。
 * 做满目标组数 → 完成；做了但没做满 → 部分完成；一组没做 → 跳过。
 */
function itemState(session, item) {
  const target = Number(item.targets?.sets);
  const targetSets = Number.isFinite(target) && target > 0 ? Math.round(target) : 0;
  const raw = Number(itemDraft(session.sessionId, item.sessionItemId).actuals?.sets);
  const done = Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;

  // 没有组数目标的动作（例如纯时长类）只有做了和没做两种结果。
  if (targetSets === 0) return { status: done > 0 ? 'done' : 'skipped', done: 0, target: 0 };
  if (done === 0) return { status: 'skipped', done: 0, target: targetSets };
  return { status: done >= targetSets ? 'done' : 'partial', done, target: targetSets };
}

function buildDrafts() {
  for (const key of Object.keys(drafts)) delete drafts[key];
  for (const key of Object.keys(expandedItems)) delete expandedItems[key];
  for (const session of sessions.value) {
    const stored = readStoredDraft(session.sessionId);
    const draft = {
      items: {},
      feel: stored?.feel ?? session.execution?.sessionFeel ?? '',
      discomfort: stored?.discomfort ?? session.execution?.discomfort ?? '',
      kicked: false,
      extrasOpen: []
    };
    for (const item of session.items) {
      draft.items[item.sessionItemId] = stored?.items?.[item.sessionItemId] || createItemDraft(item);
    }
    drafts[session.sessionId] = draft;
  }
}

/**
 * 录入值按以下顺序确定：本地草稿 > 本次已保存记录 > 上一次成绩 > 计划目标。
 * 组数只代表本次完成度，首次打开时必须保持为空，不能替用户确认完成。
 */
function createItemDraft(item) {
  const actuals = {};
  const seed = item.lastActuals || {};
  const recorded = item.execution?.actuals || {};

  for (const metric of Object.keys(item.targets || {})) {
    if (metric === 'duration' || metric === 'durationSeconds') continue;
    if (item.execution) {
      actuals[metric] = recorded[metric] ?? null;
      continue;
    }
    if (metric === 'sets') {
      actuals.sets = null;
      continue;
    }
    const previous = Number(seed[metric]);
    actuals[metric] = Number.isFinite(previous) && previous > 0 ? previous : item.targets[metric];
  }

  if (item.execution) {
    if (recorded.durationSeconds != null) actuals.durationSeconds = recorded.durationSeconds;
  } else {
    const previousSeconds = Number(seed.durationSeconds);
    if (Number.isFinite(previousSeconds) && previousSeconds > 0) {
      actuals.durationSeconds = previousSeconds;
    } else {
      // 没有历史可参照时按时长目标预填，与面板上的显示保持一致。
      const targetSeconds = targetDurationSeconds(item.targets || {});
      if (targetSeconds > 0) actuals.durationSeconds = targetSeconds;
    }
  }

  return {
    actuals,
    skipReason: item.execution?.skipReason || '',
    note: item.execution?.note || ''
  };
}

function targetDurationSeconds(targets) {
  if (Number(targets.durationSeconds) > 0) return Math.round(Number(targets.durationSeconds));
  if (Number(targets.duration) > 0) {
    return Math.round(Number(targets.duration) * (targets.durationUnit === 'seconds' ? 1 : 60));
  }
  return 0;
}

function readStoredDraft(sessionId) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(draftKey(sessionId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function draftHasContent(sessionId) {
  const draft = sessionDraft(sessionId);
  if (draft.feel || draft.discomfort) return true;
  return Object.values(draft.items || {}).some(
    (item) =>
      item.skipReason || item.note || Object.values(item.actuals || {}).some((value) => value !== null && value !== '')
  );
}

function updateItem(sessionId, sessionItemId, patch) {
  const draft = sessionDraft(sessionId);
  const current = itemDraft(sessionId, sessionItemId);
  draft.items[sessionItemId] = {
    ...current,
    ...patch,
    actuals: patch.actuals ? { ...current.actuals, ...patch.actuals } : current.actuals
  };
  persistDraft(sessionId);
}

/**
 * 「完成 / 跳过」按钮调整的是组数：目标是几组就记几组，跳过则清零。
 * 组数是完成度的唯一来源，不再单独保存一个状态字段，避免两者不同步。
 */
function setItemComplete(sessionId, sessionItemId, complete) {
  const session = sessions.value.find((entry) => entry.sessionId === sessionId);
  const item = session?.items.find((entry) => entry.sessionItemId === sessionItemId);
  const targetSets = Number(item?.targets?.sets);
  const sets = !complete ? 0 : Number.isFinite(targetSets) && targetSets > 0 ? Math.round(targetSets) : 1;
  updateItem(sessionId, sessionItemId, { actuals: { sets } });
}

function itemKey(sessionId, sessionItemId) {
  return `${sessionId}:${sessionItemId}`;
}

function isDetailsOpen(sessionId, sessionItemId) {
  return Boolean(expandedItems[itemKey(sessionId, sessionItemId)]);
}

function toggleDetails(sessionId, sessionItemId) {
  const key = itemKey(sessionId, sessionItemId);
  expandedItems[key] = !expandedItems[key];
}

function updateSession(sessionId, patch) {
  Object.assign(sessionDraft(sessionId), patch);
  persistDraft(sessionId);
}

function persistDraft(sessionId) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (!draftHasContent(sessionId)) {
      localStorage.removeItem(draftKey(sessionId));
      return;
    }
    localStorage.setItem(draftKey(sessionId), JSON.stringify(sessionDraft(sessionId)));
  } catch {
    // 隐私模式下 localStorage 可能不可写，草稿功能降级但不影响提交。
  }
}

function clearDraft(sessionId) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(draftKey(sessionId));
    } catch {
      // 忽略清理失败
    }
  }
  const draft = drafts[sessionId];
  if (draft) {
    // 保留当前页面的已保存值，让保存成功后的状态和进度立即可见。
    // 下一次加载仍会从服务端 execution 重建，草稿文件本身已经被清掉。
    draft.kicked = false;
  }
}

// 整次完成度按逐项状态汇总：部分完成也算「练了」，但不计入完成项数。
function sessionState(session) {
  const states = session.items.map((item) => itemState(session, item));
  return {
    done: states.filter((state) => state.status === 'done').length,
    partial: states.filter((state) => state.status === 'partial').length,
    skipped: states.filter((state) => state.status === 'skipped').length,
    total: states.length
  };
}

function sessionDoneCount(session) {
  return sessionState(session).done;
}

function statusLabel(session) {
  const state = sessionState(session);
  if (state.done === state.total) return t('mobile.statusCompleted');
  if (state.done + state.partial === 0) return t('mobile.statusSkipped');
  return t('mobile.statusPartial');
}

function statusTagType(session) {
  const state = sessionState(session);
  if (state.done === state.total) return 'success';
  if (state.done + state.partial === 0) return 'danger';
  return 'warning';
}

function shiftDate(offset) {
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offset);
  navigateTo(date.toISOString().slice(0, 10));
}

function goToday() {
  navigateTo(todayString());
}

function navigateTo(date) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LAST_DATE_KEY, date);
    } catch {
      // 忽略持久化失败
    }
  }
  router.replace({ name: 'mobile-today', query: date === todayString() ? {} : { date } });
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const response = await getTrainingExecution(selectedDate.value);
    sessions.value = response.sessions || [];
    buildDrafts();
  } catch (requestError) {
    sessions.value = [];
    buildDrafts();
    error.value = normalizeRequestError(requestError, t) || t('mobile.loadFailed');
  } finally {
    loading.value = false;
  }
}

function buildPayload(session) {
  const draft = sessionDraft(session.sessionId);
  const items = session.items.map((item) => {
    const current = itemDraft(session.sessionId, item.sessionItemId);
    const state = itemState(session, item);
    const actuals = {};
    for (const [metric, value] of Object.entries(current.actuals || {})) {
      // duration 只是编辑用的拆分字段，真实存储只认 durationSeconds。
      if (metric === 'duration') continue;
      // 空值表示「这项没记」，直接省略，由服务端按未记录处理。
      if (value === null || value === undefined || value === '' || Number(value) <= 0) continue;
      actuals[metric] = Number(value);
    }
    return {
      // 状态由组数完成度推导，不再直接沿用按钮状态。
      sessionItemId: item.sessionItemId,
      status: state.status === 'skipped' ? 'skipped' : 'done',
      actuals: state.status === 'skipped' ? {} : actuals,
      // 当前移动端暂不采集跳过原因，服务端字段保留用于兼容历史记录。
      skipReason: ''
    };
  });
  const state = sessionState(session);
  return {
    status: state.done + state.partial === 0 ? 'skipped' : state.done === state.total ? 'completed' : 'partial',
    sessionFeel: draft.feel || undefined,
    discomfort: draft.discomfort || '',
    completedAt: Date.now(),
    items
  };
}

function collectRecordedActuals(session) {
  const recorded = {};
  for (const item of session.items) {
    const source = itemDraft(session.sessionId, item.sessionItemId).actuals || {};
    const cleaned = {};
    for (const [metric, value] of Object.entries(source)) {
      if (value === null || value === undefined || value === '' || Number(value) === 0) continue;
      cleaned[metric] = Number(value);
    }
    if (Object.keys(cleaned).length > 0) recorded[item.sessionItemId] = cleaned;
  }
  return recorded;
}

async function saveSession(session) {
  const payload = buildPayload(session);
  const response = await saveTrainingSessionExecution(session.sessionId, payload);
  session.execution = response.execution;

  // 保存成功后把当前值当作「上次成绩」，这样同一天再改再存时预填仍然正确。
  const recorded = collectRecordedActuals(session);
  for (const item of session.items) {
    if (recorded[item.sessionItemId]) item.lastActuals = recorded[item.sessionItemId];
  }
  clearDraft(session.sessionId);
}

/**
 * 保存当天所有待确认的训练单元。
 * 全部标记为跳过时需要再点一次确认，避免误操作把整天记成跳过。
 */
async function submitAll() {
  const pending = confirmableSessions.value;
  if (pending.length === 0) return;

  const allSkipped = pending.every((session) => sessionState(session).done + sessionState(session).partial === 0);
  const needsConfirm = allSkipped && pending.some((session) => !sessionDraft(session.sessionId).kicked);
  if (needsConfirm) {
    for (const session of pending) sessionDraft(session.sessionId).kicked = true;
    showToast(t('mobile.confirmAllSkipped'));
    return;
  }

  savingSessionId.value = pending[0].sessionId;
  try {
    for (const session of pending) {
      await saveSession(session);
    }
    showSuccessToast(t('mobile.saved'));
  } catch (requestError) {
    error.value = normalizeRequestError(requestError, t) || t('mobile.saveFailed');
    showFailToast(error.value);
  } finally {
    savingSessionId.value = null;
  }
}

watch(selectedDate, () => {
  load();
});

onMounted(async () => {
  if (typeof localStorage !== 'undefined' && !route.query.date) {
    try {
      const remembered = localStorage.getItem(LAST_DATE_KEY);
      if (remembered && /^\d{4}-\d{2}-\d{2}$/.test(remembered) && remembered !== todayString()) {
        router.replace({ name: 'mobile-today', query: { date: remembered } });
        return;
      }
    } catch {
      // 忽略读取失败
    }
  }
  await load();
});
</script>

<style scoped lang="scss">
.mobile-training {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.mobile-training__dates {
  position: sticky;
  top: 60px;
  z-index: 9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  background: var(--app-bg);
  border-bottom: 1px solid var(--card-border);
}

.date-step {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  color: var(--text-primary);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  font-size: 16px;
}

.date-step:disabled {
  opacity: 0.4;
}

.date-current {
  display: flex;
  align-items: center;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.date-current strong {
  color: var(--text-primary);
  font-size: 16px;
}

.date-current__back {
  color: var(--primary-color);
  font-size: 12px;
}

.mobile-training__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  padding: 16px 16px 24px;
}

.mobile-training__loading {
  padding: 8px;
}

.training-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  color: var(--danger-color);
  background: var(--danger-light);
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
}

.training-error .van-icon {
  flex: none;
  margin-top: 2px;
  font-size: 16px;
}

.training-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 10px;
  padding: 48px 16px;
}

.training-empty__icon {
  color: var(--text-tertiary);
  font-size: 44px;
}

.training-empty p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.session-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  box-shadow: var(--card-shadow);
}

.session-block__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.session-block__title h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
  text-align: left;
}

.session-block__title p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: left;
}

.session-block__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.session-block__automatic {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-block__notes {
  margin: 0;
  padding: 10px 12px;
  color: var(--text-secondary);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  font-size: 13px;
  text-align: left;
}

.session-block__auto {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  color: var(--text-secondary);
  background: var(--card-bg);
  border: 1px dashed var(--card-border);
  border-radius: 12px;
}

.session-block__auto p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  text-align: left;
}

.session-block__auto-icon {
  flex: none;
  color: var(--primary-color);
  font-size: 20px;
}

.session-block__feel {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
}

.session-block__extras {
  overflow: hidden;
  border: 1px solid var(--card-border);
  border-radius: 10px;
}

.session-block__extras :deep(.van-collapse-item__content) {
  padding: 10px;
  background: var(--app-bg);
}

.session-block__extras .session-block__feel {
  padding: 0 0 12px;
  background: transparent;
  border: 0;
}

.session-block__feel-label {
  flex: none;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
}

/* 让三个感受选项在剩余宽度里均匀分布，而不是挤在标题旁边。 */
.session-block__feel :deep(.van-radio-group) {
  display: flex;
  flex: 1;
  justify-content: space-around;
  min-width: 0;
}

.session-block__feel :deep(.van-radio) {
  margin-right: 0;
}

.session-block__discomfort {
  padding: 10px 12px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
}

.session-block__discomfort :deep(.van-field__label) {
  width: auto;
  margin-right: 12px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
}

.mobile-training__footer {
  position: sticky;
  bottom: 0;
  z-index: 9;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: var(--card-bg);
  border-top: 1px solid var(--card-border);
  box-shadow: 0 -4px 16px rgb(15 23 42 / 8%);
}

.mobile-training__progress {
  flex: none;
  color: var(--text-secondary);
  font-size: 13px;
}

.mobile-training__save {
  flex: 1;
  height: 46px;
  margin: 0;
  font-size: 16px;
}
</style>

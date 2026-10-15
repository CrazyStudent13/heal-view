import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildSessionFilterRequest,
  emptySessionFilters,
  hasSessionFilters,
  summarizeSessionFilters
} from '../../client/src/utils/sessionFilters.js';

const pageSource = fs.readFileSync(
  fileURLToPath(new URL('../../client/src/pages/plans/PlanSessionsPage.vue', import.meta.url)),
  'utf8'
);

test('drops blank filter fields from the request instead of sending empty values', () => {
  // 空字符串对服务端应该是"这个条件没给"，不能变成 `startDate=`。
  assert.deepEqual(buildSessionFilterRequest(emptySessionFilters()), {
    startDate: undefined,
    endDate: undefined,
    planId: undefined,
    status: undefined,
    logged: undefined,
    search: undefined
  });

  assert.deepEqual(
    buildSessionFilterRequest({ startDate: '2026-10-01', planId: 7, status: 'missed', search: '  平板  ' }),
    {
      startDate: '2026-10-01',
      endDate: undefined,
      planId: 7,
      status: 'missed',
      logged: undefined,
      search: '平板'
    }
  );

  // 打卡状态的 'false' 是真值字符串，不能被当成空值顺手丢掉。
  assert.equal(buildSessionFilterRequest({ ...emptySessionFilters(), logged: 'false' }).logged, 'false');
  assert.equal(buildSessionFilterRequest({ ...emptySessionFilters(), logged: 'true' }).logged, 'true');

  // 缺字段时不能抛错，也不能把 undefined 变成字符串。
  assert.deepEqual(buildSessionFilterRequest(undefined), buildSessionFilterRequest(emptySessionFilters()));
});

test('treats only a usable condition as an active filter', () => {
  assert.equal(hasSessionFilters(emptySessionFilters()), false);
  assert.equal(hasSessionFilters(undefined), false);
  // 只有空白的关键词不算条件：否则"删除筛选结果"会以为自己有约束。
  assert.equal(hasSessionFilters({ ...emptySessionFilters(), search: '   ' }), false);
  assert.equal(hasSessionFilters({ ...emptySessionFilters(), search: '平板' }), true);
  assert.equal(hasSessionFilters({ ...emptySessionFilters(), status: 'missed' }), true);
  assert.equal(hasSessionFilters({ ...emptySessionFilters(), endDate: '2026-10-31' }), true);
  assert.equal(hasSessionFilters({ ...emptySessionFilters(), logged: 'false' }), true);
});

test('summarizes the applied filters in a fixed order for the delete dialog', () => {
  const translate = (key, params = {}) => {
    if (key === 'common.listSeparator') return ' / ';
    const entries = Object.entries(params);
    if (entries.length === 0) return key;
    return `${key}(${entries.map(([name, value]) => `${name}=${value}`).join(',')})`;
  };

  const summary = summarizeSessionFilters(
    { startDate: '2026-10-01', endDate: '2026-10-31', planId: 9, status: 'missed', logged: 'false', search: '平板' },
    { translate, planName: () => '减脂计划' }
  );
  assert.equal(
    summary,
    [
      'plans.sessions.conditionDateRange(start=2026-10-01,end=2026-10-31)',
      'plans.sessions.conditionPlan(name=减脂计划)',
      'plans.sessions.conditionStatus(status=plans.manager.statuses.missed)',
      'plans.sessions.conditionLogged(status=plans.sessions.loggedNo)',
      'plans.sessions.conditionSearch(keyword=平板)'
    ].join(' / ')
  );

  // 只有一个日期端点时不能说成"至 undefined"。
  assert.equal(
    summarizeSessionFilters({ startDate: '2026-10-01' }, { translate }),
    'plans.sessions.conditionDateFrom(start=2026-10-01)'
  );
  assert.equal(
    summarizeSessionFilters({ endDate: '2026-10-31' }, { translate }),
    'plans.sessions.conditionDateUntil(end=2026-10-31)'
  );
  // 已打卡 / 未打卡各用自己的文案，不能说反。
  assert.equal(
    summarizeSessionFilters({ logged: 'true' }, { translate }),
    'plans.sessions.conditionLogged(status=plans.sessions.logged)'
  );
  assert.equal(
    summarizeSessionFilters({ logged: 'false' }, { translate }),
    'plans.sessions.conditionLogged(status=plans.sessions.loggedNo)'
  );
  // 计划名查不到时退回 id，摘要里不能出现空名字。
  assert.equal(summarizeSessionFilters({ planId: 12 }, { translate }), 'plans.sessions.conditionPlan(name=12)');
  assert.equal(summarizeSessionFilters(emptySessionFilters(), { translate }), '');
});

/**
 * 页面接线：删除必须和"屏幕上这批行"是同一批。
 * 这里守的是两个最容易写错、后果又最重的地方——删除认的是请求快照而不是输入框的当前值，
 * 以及破坏性操作必须先勾确认。
 */
test('deletes exactly what is on screen after an explicit confirmation', () => {
  assert.match(pageSource, /appliedFilters\.value = currentFilters\(\)/);
  // 条件删除要把弹窗里显示的条数一起带上，服务端对不上就拒绝（409）。
  assert.match(
    pageSource,
    /deleteTrainingSessionsByFilter\(requestFilters\(appliedFilters\.value\), deleteScope\.value\.count\)/
  );
  assert.match(pageSource, /requestError\.code === 'SESSION_DELETE_COUNT_CHANGED'/);
  assert.match(pageSource, /deleteTrainingSessions\(selectedIds\.value\)/);
  assert.match(pageSource, /:disabled="!deleteConfirmed \|\| deleteScope\.count === 0"/);
  assert.match(pageSource, /if \(!hasActiveFilters\.value\)/);
  // 服务端算出来的条数才是弹窗里的条数，别拿本地 state 估。
  assert.match(pageSource, /count: preview\.total/);
  // 勾选要能跨页留住，否则"删一大类"还是得翻页十几次。
  assert.match(pageSource, /reserve-selection/);
  // 检索条件只留"训练内容搜索"这一个输入框，而且排在日期/计划/状态之前。
  const searchIndex = pageSource.indexOf('session-search-filter');
  const datePickerIndex = pageSource.indexOf('session-date-filter');
  assert.ok(searchIndex > -1, '训练内容搜索框存在');
  assert.ok(searchIndex < datePickerIndex, '训练内容搜索框排在日期筛选之前');
  assert.match(pageSource, /t\('plans\.sessions\.filterSearch'\)/);
  // 打卡状态是一个独立筛选项，值分别是 'true' / 'false'，和完成状态分开传。
  assert.match(pageSource, /v-model="logged"/);
  assert.match(pageSource, /value="true"/);
  assert.match(pageSource, /value="false"/);
  assert.match(pageSource, /logged: logged\.value \|\| ''/);
  // 打卡标签挂在日期列里，而不是挤在完成状态旁边。
  assert.match(pageSource, /class="session-date-cell"[\s\S]{0,200}?session-logged-tag/);
});

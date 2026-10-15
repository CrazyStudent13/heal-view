import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const pageSource = fs.readFileSync(
  fileURLToPath(new URL('../../client/src/pages/plans/PlanSessionsPage.vue', import.meta.url)),
  'utf8'
);
const apiSource = fs.readFileSync(
  fileURLToPath(new URL('../../client/src/api/fitnessApi.js', import.meta.url)),
  'utf8'
);

/**
 * 训练内容的删除有两条入口，走的是同一个接口但入参不同：
 * 展开行按 id 删一条，工具栏那条按"训练项目 + 当前筛选条件"批删。
 * 这里守的是几条错了会有真实后果的接线。
 */
test('deletes a single training item by id from the expanded session row', () => {
  assert.match(apiSource, /export function deleteTrainingSessionItems\(payload\)/);
  assert.match(pageSource, /<el-table-column type="expand"/);
  assert.match(pageSource, /deleteTrainingSessionItems\(\{ ids: \[item\.id\] \}\)/);
  // 单元只配了这一个项目时服务端会跳过，界面必须照实提示，不能谎报成功。
  assert.match(pageSource, /result\.deletedCount === 0[\s\S]{0,160}?itemDeleteLastOne/);
  assert.match(pageSource, /:disabled="!itemDeleteConfirmed \|\| !canSubmitItemDelete"/);
});

test('batch deletes training content within the applied filter scope only', () => {
  // 作用范围和列表同源：预览和删除都发同一份已提交的筛选条件。
  assert.match(
    pageSource,
    /getTrainingSessionItemDeletePreview\(\{[\s\S]{0,120}?\.\.\.requestFilters\(appliedFilters\.value\)/
  );
  assert.match(
    pageSource,
    /filter: requestFilters\(appliedFilters\.value\),[\s\S]{0,160}?expectedCount: preview\.deletableItemCount/
  );
  // 没设筛选条件时不给提交，并且明确告诉用户要先圈定范围。
  assert.match(pageSource, /hasActiveFilters\.value && \(itemDeletePreview\.value\?\.deletableItemCount \?\? 0\) > 0/);
  assert.match(pageSource, /v-else[\s\S]{0,200}?itemDeleteFilterRequired/);
  // 训练项目来自项目目录，展开行和批删用的是同一份名称。
  assert.match(pageSource, /getTrainingExercises\(\)/);
  // 与单元批删一样：服务端回报的数量对不上时关掉弹窗重新拉列表。
  assert.match(pageSource, /SESSION_ITEM_DELETE_COUNT_CHANGED/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildTrainingExercisePayload, updateMetricSelection } from '../../client/src/utils/trainingExercise.js';

const clientRoot = fileURLToPath(new URL('../../client', import.meta.url));

test('updates selected training metrics without mutating the existing array', () => {
  const initial = ['duration'];
  const selected = updateMetricSelection(initial, 'distance', true);
  const deselected = updateMetricSelection(selected, 'duration', false);

  assert.deepEqual(initial, ['duration']);
  assert.deepEqual(selected, ['duration', 'distance']);
  assert.deepEqual(deselected, ['distance']);
});

test('copies selected metrics into the training exercise request payload', () => {
  const form = {
    name: 'Cycling',
    icon: 'mdi:bike',
    category: 'aerobic',
    scene: 'outdoor',
    verificationMode: 'auto',
    equipmentMode: 'equipment',
    equipment: 'Bicycle',
    metrics: ['duration', 'distance'],
    purpose: 'Cardio'
  };

  const payload = buildTrainingExercisePayload(form);
  form.metrics.push('speed');

  assert.deepEqual(payload.metrics, ['duration', 'distance']);
  assert.equal(payload.equipmentMode, 'equipment');
  assert.equal(payload.equipment, 'Bicycle');
});

test('copies the imported sport types into the payload for auto-verified exercises', () => {
  const base = { name: 'Walking', icon: 'mdi:walk', category: 'aerobic', scene: 'indoor', equipmentMode: 'bodyweight' };

  const auto = buildTrainingExercisePayload({ ...base, verificationMode: 'auto', sportTypes: ['walking'] });
  assert.deepEqual(auto.sportTypes, ['walking']);

  // 手动验证的项目不参与导入数据匹配，类型配置一并清空，避免留下失效配置。
  const manual = buildTrainingExercisePayload({
    ...base,
    verificationMode: 'manual',
    sportTypes: ['walking']
  });
  assert.deepEqual(manual.sportTypes, []);

  // 表单缺少该字段时不应报错，也不应把 undefined 传给服务端。
  assert.deepEqual(buildTrainingExercisePayload({ ...base, verificationMode: 'auto' }).sportTypes, []);
});

/**
 * 计划模块的源码拼在一起断言：弹窗、详情抽屉、页签和 composable 拆分之后，
 * 这些能力仍然要能在模块里找到，但不该再绑死在某一个文件上。
 */
function readPlansModuleSource(directory = `${clientRoot}/src/pages/plans`) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const target = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return [readPlansModuleSource(target)];
      return /\.(vue|js)$/.test(entry.name) ? [fs.readFileSync(target, 'utf8')] : [];
    })
    .join('\n');
}

/**
 * 有氧自动匹配的两个比例必须分开显示。
 * 合并成一个总分会让"没导入数据"看起来像"没完成"，这正是第一阶段要避免的误导。
 */
test('shows data coverage and verifiable completion as separate figures', () => {
  const source = readPlansModuleSource();

  assert.match(source, /plans\.manager\.coverageRate/);
  assert.match(source, /plans\.manager\.verifiableCompletionRate/);
  // 没有可验证项目时整块隐藏，不显示 0%。
  assert.match(source, /v-if="hasVerifiableItems"/);
  assert.match(source, /function formatRate\(rate\)[\s\S]{0,120}?return '--'/);
  // 训练项目上要能看到匹配到的导入记录和自动判定结果。
  assert.match(source, /item\.match\?\.ambiguous/);
  assert.match(source, /matchSummary\(item\.match\)/);
  // 计划列表也要带上覆盖率，否则列表接口返回的 coverage 没人使用。
  assert.match(source, /row\.coverage\?\.verifiableItems[\s\S]{0,160}?formatRate\(row\.coverage\.coverageRate\)/);
});

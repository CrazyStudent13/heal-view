import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = fileURLToPath(new URL('../../client', import.meta.url));
const mobileRoot = path.join(clientRoot, 'src/pages/mobile');
const viteConfigSource = fs.readFileSync(path.join(clientRoot, 'vite.config.js'), 'utf8');
const routerSource = fs.readFileSync(path.join(clientRoot, 'src/router/index.js'), 'utf8');

function listVueFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listVueFiles(fullPath);
    return entry.name.endsWith('.vue') ? [fullPath] : [];
  });
}

const mobileFiles = listVueFiles(mobileRoot);

test('keeps the Vant auto-import scoped to the mobile pages', () => {
  // 移动端用 Vant、桌面端继续用 Element Plus，扫描范围必须限定在移动端目录，
  // 否则两套组件库会互相污染。
  assert.match(viteConfigSource, /unplugin-vue-components\/vite/);
  assert.match(viteConfigSource, /VantResolver/);
  assert.match(viteConfigSource, /include:\s*\[\s*\/src\\\/pages\\\/mobile/);
});

test('routes every Vant component through the mobile pages only', () => {
  const vantUsage = mobileFiles.filter((file) => /<van-[a-z-]+/.test(fs.readFileSync(file, 'utf8')));
  assert.ok(vantUsage.length > 0, 'mobile pages should use Vant components');

  // 移动端不应再出现 Element Plus 组件标签，避免两套设计语言混在同一页面。
  for (const file of mobileFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const elementTags = source.match(/<el-[a-z-]+/g) || [];
    assert.deepEqual(elementTags, [], `${path.relative(clientRoot, file)} still uses Element Plus components`);
  }
});

test('maps the Vant theme onto the existing design tokens', () => {
  const layout = fs.readFileSync(path.join(mobileRoot, 'MobileLayout.vue'), 'utf8');
  // 通过 ConfigProvider 下发主题变量，避免两套设计语言出现不同的配色。
  assert.match(layout, /van-config-provider/);
  assert.match(layout, /:theme-vars="themeVars"/);
  assert.match(layout, /primaryColor:\s*'var\(--primary-color\)'/);
  assert.match(layout, /background2:\s*'var\(--card-bg\)'/);
  assert.match(layout, /:theme="themeStore\.isDarkMode \? 'dark' : 'light'"/);
});

test('keeps the personal check-in entry at /m/today without auth interception', () => {
  assert.match(routerSource, /path:\s*'\/m'/);
  assert.match(routerSource, /redirect:\s*'\/m\/today'/);
  assert.match(routerSource, /path:\s*'today'[\s\S]*?meta:\s*\{\s*titleKey:\s*'mobile\.title',\s*public:\s*true\s*\}/);
});

test('does not prefill an unrecorded exercise as completed', () => {
  const trainingPage = fs.readFileSync(path.join(mobileRoot, 'TrainingPage.vue'), 'utf8');
  assert.match(trainingPage, /if\s*\(metric\s*===\s*'sets'\)\s*\{[\s\S]*?actuals\.sets\s*=\s*null/);
  assert.doesNotMatch(trainingPage, /TrainingItemChips/);
});

/**
 * 服务端按动作声明的指标严格校验 actuals，提交一个该动作不支持的指标会让整次保存被判 400。
 * 实际出现过两处漏洞：点「完成本项」时无条件写入 sets（椭圆机等纯时长动作被拒），
 * 以及把本地草稿里的旧值原样发出（修复写入路径后，脏草稿仍会让保存失败）。
 * 这里锁住两道过滤，避免再次绕过。
 */
test('filters actuals by the metrics each exercise declares', () => {
  const trainingPage = fs.readFileSync(path.join(mobileRoot, 'TrainingPage.vue'), 'utf8');
  // 点「完成本项」时，组数只对声明了 sets 的动作写入。
  assert.match(trainingPage, /supportedMetrics\.has\('sets'\)[\s\S]{0,120}?actuals\.sets\s*=/);
  // 发送前按动作支持的指标过滤草稿，脏数据不会提交给服务端。
  assert.match(trainingPage, /if\s*\(!supportedMetrics\.has\(metric\)\)\s*continue;/);
  assert.match(
    trainingPage,
    /if\s*\(supportedMetrics\.has\('duration'\)\)\s*supportedMetrics\.add\('durationSeconds'\)/
  );
});

/**
 * 没有 sets 目标的动作（椭圆机等）永远不会有 sets 值，完成度只能看「有没有记录值」，
 * 否则点「完成本项」后状态仍是 skipped，当天进度少一项、整天保存不上去。
 */
test('marks exercises without a sets target by their recorded values', () => {
  const trainingPage = fs.readFileSync(path.join(mobileRoot, 'TrainingPage.vue'), 'utf8');
  assert.doesNotMatch(trainingPage, /targetSets === 0\)\s*return\s*\{\s*status:\s*done > 0/);
  assert.match(
    trainingPage,
    /targetSets === 0\)\s*\{[\s\S]{0,400}?skipped[\s\S]{0,120}?recorded \? 'done' : 'skipped'/
  );

  const panel = fs.readFileSync(path.join(mobileRoot, 'components/TrainingItemPanel.vue'), 'utf8');
  // 面板的完成高亮同样要按「有记录值」判断，否则倒计时记完时长仍显示未记录。
  assert.match(panel, /targetSets\.value > 0 \? completedSets\.value >= targetSets\.value : hasRecordedActuals\.value/);
  // 倒计时不得给不支持 sets 的动作写 sets（会被服务端拒收）。
  assert.match(panel, /if\s*\(usesSetsPicker\.value\)\s*\{[\s\S]{0,160}?actuals\.sets\s*=/);
});

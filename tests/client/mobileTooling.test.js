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
  assert.doesNotMatch(trainingPage, /actuals\.sets\s*=\s*Number\.isFinite\(targetSets\)/);
  assert.doesNotMatch(trainingPage, /TrainingItemChips/);
});

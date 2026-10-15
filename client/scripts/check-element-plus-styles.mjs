/**
 * Element Plus 按需引入的样式核对脚本（验收工具，非构建流程的一部分）。
 *
 * 目的：确认「模板/脚本里实际用到的每一个 Element Plus 组件、指令、命令式 API」，
 * 其样式都真实存在于 dist 产物中。只看体积无法发现"少引入某个样式"这类回归。
 *
 * 做法：
 *  1. 声明式列出项目里对 Element Plus 的全部用法；
 *  2. 对每个用法，取它在 element-plus/theme-chalk/el-<name>.css 里的**自有**特征类名
 *     （出现次数最多者），再去 dist 的所有 CSS 文件里检索；
 *  3. 少数组件的 theme-chalk 文件是 0 字节占位（config-provider / date-picker /
 *     tab-pane / tooltip），其样式由子组件提供，这时用 STYLE_ASSERTIONS 里明确写死的
 *     子样式特征类名核对；
 *  4. 反向检查：确认未使用组件（carousel / color-picker / transfer / …）的样式
 *     没有被打进 dist，即按需引入没有退化成全量引入。
 *
 * 用法：node scripts/check-element-plus-styles.mjs
 * 前置：先执行 `pnpm --filter heal-view-client build`。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const distDir = fileURLToPath(new URL('../dist', import.meta.url));
const assetsDir = join(distDir, 'assets');

// element-plus 的 theme-chalk 是构建产物 css，直接读它最权威。
// 通过 client 自己的 node_modules 软链解析，避免硬编码 pnpm 的 .pnpm 目录名。
const themeChalkDir = fileURLToPath(new URL('../node_modules/element-plus/theme-chalk', import.meta.url));
const esComponentsDir = fileURLToPath(new URL('../node_modules/element-plus/es/components', import.meta.url));

/**
 * 声明式清单：项目里所有对 Element Plus 的用法。
 */
// 模板中的 <el-*> 标签：由 ElementPlusResolver 按需注入「组件 + 样式」。
const TEMPLATE_COMPONENTS = [
  'alert',
  'button',
  'card',
  'checkbox',
  'checkbox-group',
  'config-provider',
  'date-picker',
  'descriptions',
  'descriptions-item',
  'dialog',
  'divider',
  'drawer',
  'empty',
  'form',
  'form-item',
  'icon',
  'input',
  'input-number',
  'option',
  'pagination',
  'popconfirm',
  'radio-button',
  'radio-group',
  'rate',
  'segmented',
  'select',
  'skeleton',
  'skeleton-item',
  'step',
  'steps',
  'switch',
  'table',
  'table-column',
  'tab-pane',
  'tabs',
  'text',
  'tooltip',
  'upload'
];

// JS 里显式 import 的组件：resolver 不注入样式，由
// src/styles/element-plus-on-demand.js 显式补样式。
const SCRIPT_COMPONENTS = [
  'alert',
  'button',
  'dialog',
  'empty',
  'icon',
  'popconfirm',
  'radio-button',
  'radio-group',
  'table',
  'table-column',
  'tag',
  'upload'
];

// 命令式 API：由 JS 直接调用，不产生模板标签。
const IMPERATIVE = [
  { name: 'ElMessage', styleName: 'message', note: '21 个文件显式 import' },
  { name: 'ElMessageBox', styleName: 'message-box', note: 'pages/import/composables/useImportHistory.js' }
];

// 指令。
const DIRECTIVES = [{ name: 'v-loading', styleName: 'loading', note: 'main.js 全局注册，4 个页面使用' }];

/**
 * theme-chalk 里 0 字节占位文件的真实样式来源。
 * 这些组件自身的 css 为空，样式在子组件里，必须显式断言，避免"用依赖的类名蒙混过关"。
 */
const STYLE_ASSERTIONS = {
  'config-provider': { via: '无自有样式（0 字节占位文件），仅需 base 变量', classes: [] },
  'tab-pane': { via: 'el-tabs（tabs 里承载 pane 的样式）', classes: ['.el-tabs__content'] },
  tooltip: { via: 'el-popper', classes: ['.el-popper'] },
  'date-picker': { via: 'el-date-picker-panel', classes: ['.el-picker-panel', '.el-date-table-cell'] }
};

// 这些组件的 theme-chalk 文件会把 dist 里必然存在的通用类名排在最前
// （例如 ElMessageBox 的 input 样式），因此显式指定组件自有类名，避免假阳性。
const CLASS_OVERRIDES = {
  'message-box': ['.el-message-box']
};

function readAllDistCss() {
  const out = new Map();
  for (const name of readdirSync(assetsDir)) {
    if (name.endsWith('.css')) out.set(`assets/${name}`, readFileSync(join(assetsDir, name), 'utf8'));
  }
  return out;
}

/** 取 theme-chalk/el-<name>.css 中该组件**自有**的特征类名（出现次数最多者优先） */
function ownSignature(styleName, topN = 6) {
  const file = join(themeChalkDir, `el-${styleName}.css`);
  if (!existsSync(file)) return { exists: false, bytes: 0, classes: [] };
  const css = readFileSync(file, 'utf8');
  const counts = new Map();
  for (const m of css.matchAll(/\.el-[a-z0-9-]+/g)) counts.set(m[0], (counts.get(m[0]) || 0) + 1);
  const classes = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, topN)
    .map(([cls]) => cls);
  return { exists: true, bytes: Buffer.byteLength(css), classes };
}

/** 读取 es/components/<name>/style/css.mjs 里声明的依赖，仅用于报告展示 */
function styleDependencies(styleName) {
  const entry = join(esComponentsDir, styleName, 'style', 'css.mjs');
  if (!existsSync(entry)) return [];
  const code = readFileSync(entry, 'utf8');
  const deps = new Set();
  for (const m of code.matchAll(/\.\.\/\.\.\/([a-z0-9-]+)\/style\/css\.mjs/g)) deps.add(m[1]);
  for (const m of code.matchAll(/theme-chalk\/el-([a-z0-9-]+)\.css/g)) deps.add(m[1]);
  return [...deps].filter((d) => d !== styleName);
}

function findInDist(distCss, cls) {
  const hits = [];
  for (const [name, css] of distCss) if (css.includes(cls)) hits.push(name);
  return hits;
}

const distCss = readAllDistCss();
const rows = [];
let failures = 0;

function check(group, styleName, label) {
  const own = ownSignature(styleName);
  if (!own.exists) {
    rows.push({ group, label, status: 'MISSING-SOURCE', detail: `theme-chalk/el-${styleName}.css 不存在` });
    failures += 1;
    return;
  }

  const assertion = STYLE_ASSERTIONS[styleName];
  const candidates = CLASS_OVERRIDES[styleName] || assertion?.classes?.length ? CLASS_OVERRIDES[styleName] || assertion.classes : own.classes;
  const via = assertion ? `样式来自 ${assertion.via}` : `theme-chalk/el-${styleName}.css (${own.bytes} B)`;

  if (candidates.length === 0) {
    rows.push({ group, label, status: 'NOTE', detail: `${via}，无类选择器可核对` });
    return;
  }

  for (const cls of candidates) {
    const hits = findInDist(distCss, cls);
    if (hits.length) {
      rows.push({
        group,
        label,
        status: 'OK',
        detail: `${cls} → ${hits.slice(0, 3).join(', ')}${hits.length > 3 ? ` (+${hits.length - 3} 个文件)` : ''}｜${via}`
      });
      return;
    }
  }
  rows.push({
    group,
    label,
    status: 'MISSING',
    detail: `${candidates.join(' / ')} 在 dist CSS 中均未找到｜期望来源：${via}${styleDependencies(styleName).length ? `（依赖：${styleDependencies(styleName).join(', ')}）` : ''}`
  });
  failures += 1;
}

const kebabToPascal = (s) =>
  s
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');

for (const name of TEMPLATE_COMPONENTS) check('模板 <el-*>（resolver 按需引入）', name, `el-${name}`);
for (const name of SCRIPT_COMPONENTS) check('脚本显式 import（on-demand 补样式）', name, `El${kebabToPascal(name)}`);
for (const item of IMPERATIVE) check('命令式 API（on-demand 补样式）', item.styleName, `${item.name}｜${item.note}`);
for (const item of DIRECTIVES) check('指令（on-demand 补样式）', item.styleName, `${item.name}｜${item.note}`);

const pad = (s, n) => String(s).padEnd(n);
console.log('== Element Plus 按需样式核对（dist 产物 vs element-plus theme-chalk 源） ==');
let currentGroup = null;
for (const r of rows) {
  if (r.group !== currentGroup) {
    currentGroup = r.group;
    console.log(`\n--- ${currentGroup} ---`);
  }
  const flag = r.status === 'OK' ? ' OK ' : r.status === 'NOTE' ? 'NOTE' : 'FAIL';
  console.log(`[${flag}] ${pad(r.label, 20)} ${r.detail}`);
}

// ---------------------------------------------------------------------------
// 反向检查：未使用组件的样式不应出现在 dist（按需引入是否退化成全量引入）
// ---------------------------------------------------------------------------
const UNUSED_COMPONENT_MARKERS = [
  ['el-carousel', '.el-carousel'],
  ['el-color-picker', '.el-color-picker'],
  ['el-transfer', '.el-transfer'],
  ['el-cascader', '.el-cascader'],
  ['el-tree', '.el-tree-node'],
  ['el-timeline', '.el-timeline-item'],
  ['el-calendar', '.el-calendar'],
  ['el-image-viewer', '.el-image-viewer'],
  ['el-menu', '.el-menu-item'],
  ['el-collapse', '.el-collapse-item'],
  ['el-tour', '.el-tour'],
  ['el-anchor', '.el-anchor'],
  ['el-watermark', '.el-watermark']
];
const unusedLeaks = [];
for (const [name, css] of distCss) {
  for (const [component, marker] of UNUSED_COMPONENT_MARKERS) {
    if (css.includes(marker)) unusedLeaks.push(`${name}: ${component} (${marker})`);
  }
}

console.log('\n== 全量样式回归检查（未使用组件样式是否残留） ==');
if (unusedLeaks.length === 0) {
  console.log(`  OK：dist 中未出现 ${UNUSED_COMPONENT_MARKERS.length} 个未使用组件的样式`);
  console.log(`      （${UNUSED_COMPONENT_MARKERS.map(([c]) => c).join(' / ')}）`);
} else {
  console.log('  FAIL：疑似全量样式回归：');
  for (const l of unusedLeaks) console.log(`    ${l}`);
  failures += 1;
}

// ---------------------------------------------------------------------------
// 暗黑模式变量必须保留
// ---------------------------------------------------------------------------
const darkCss = [...distCss.entries()].filter(([, css]) => css.includes('html.dark') || css.includes('.dark{--el-color-primary'));
console.log('\n== 暗黑模式变量检查（theme-chalk/dark/css-vars.css） ==');
if (darkCss.length) {
  console.log(`  OK：dist 中存在 html.dark 变量覆盖 → ${darkCss.map(([n]) => n).join(', ')}`);
} else {
  console.log('  FAIL：dist 中找不到 html.dark 的 Element Plus 变量覆盖，暗黑模式会失效');
  failures += 1;
}

const totalCssRaw = [...distCss.values()].reduce((n, s) => n + Buffer.byteLength(s), 0);
console.log(`\ndist CSS 文件数 ${distCss.size}，合计 raw ${(totalCssRaw / 1024).toFixed(1)} KB`);
console.log(failures === 0 ? '\n结论：全部通过。' : `\n结论：${failures} 项失败。`);
process.exit(failures === 0 ? 0 : 1);

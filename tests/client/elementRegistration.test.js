import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = fileURLToPath(new URL('../../client', import.meta.url));
const srcRoot = path.join(clientRoot, 'src');
const elementPlusStyleRoot = path.join(clientRoot, 'node_modules/element-plus/theme-chalk');

const read = (...segments) => fs.readFileSync(path.join(...segments), 'utf8');

const mainSource = read(srcRoot, 'main.js');
const viteConfigSource = read(clientRoot, 'vite.config.js');
const exercisePageSource = read(srcRoot, 'pages/PlansPage.vue');
const onDemandStyleSource = read(srcRoot, 'styles/element-plus-on-demand.js');

function listFiles(directory, predicate) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath, predicate);
    return predicate(fullPath) ? [fullPath] : [];
  });
}

const vueFiles = listFiles(srcRoot, (file) => file.endsWith('.vue'));

/**
 * 收集所有 .vue 模板里出现的 <el-*> 标签。
 * 只看 <el-xxx ...> 与 </el-xxx>：`<component :is="...">` 这类动态组件
 * 在项目里只用于 @element-plus/icons-vue 的图标，不是 Element Plus 组件。
 */
function collectElementTags() {
  const tags = new Map();
  for (const file of vueFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<\/?(el-[a-z0-9-]+)/g)) {
      const tag = match[1];
      if (!tags.has(tag)) tags.set(tag, new Set());
      tags.get(tag).add(path.relative(clientRoot, file));
    }
  }
  return tags;
}

const elementTags = collectElementTags();

test('registers the Element Plus pagination component used by the exercise list', () => {
  // 原始意图：ElPagination 只在一处使用，最容易在重构里漏注册。
  // 现在它不再靠 main.js 的手工全局注册，而是靠 vite.config.js 里的
  // ElementPlusResolver 在模板出现 <el-pagination> 时按需引入组件 + 样式。
  assert.match(exercisePageSource, /<el-pagination\b/, 'PlansPage.vue 应当仍然使用 <el-pagination>');
  assert.ok(elementTags.has('el-pagination'), '全项目应当至少出现一次 <el-pagination>');

  // resolver 必须覆盖全部 .vue：旧的 include 只放行 src/pages/mobile/**，
  // 桌面端页面不在扫描范围内，模板里的 <el-*> 就完全不会被解析。
  assert.match(
    viteConfigSource,
    /import\s*\{\s*ElementPlusResolver\s*\}\s*from\s*['"]unplugin-vue-components\/resolvers['"]/
  );
  assert.match(viteConfigSource, /ElementPlusResolver\(/, 'vite.config.js 必须启用 ElementPlusResolver');
  assert.doesNotMatch(
    viteConfigSource,
    /include:\s*\[\s*\/src\\?\/pages\\?\/mobile/,
    'Components 插件的 include 不能再被限制成只扫描移动端页面，否则 Element Plus 覆盖不到桌面端'
  );

  // main.js 里不应再有那套全量全局注册
  assert.doesNotMatch(mainSource, /const elementComponents\s*=/, 'main.js 不应再批量全局注册 Element Plus 组件');
  assert.doesNotMatch(
    mainSource,
    /import\s*\{[\s\S]*\bElPagination\b[\s\S]*\}\s*from\s*['"]element-plus['"]/,
    'main.js 不应再全量 import Element Plus 组件'
  );
});

/**
 * 核心防回归：移除 element-plus/dist/index.css 之后，任何一个 Element Plus 用法
 * 只要样式没被引入，就会出现"组件在、样式没了"——lint、i18n 检查、SSR 冒烟都发现不了
 * （check-plan-module.mjs 的 SSR 冒烟是自己手工全局注册 Element Plus 的）。
 *
 * 这里把「所有实际用到的 Element Plus 组件」逐个对照 element-plus 自身的样式目录，
 * 确保：(a) 每个模板标签都能被 resolver 解析成真实存在的组件；
 *       (b) 每个组件在 theme-chalk 里确实有样式，因而 resolver 会为它注入样式；
 *       (c) 显式 import 的组件（resolver 不注入样式）与命令式 API 都已在
 *           src/styles/element-plus-on-demand.js 里显式补了样式。
 */
test('maps every Element Plus component in the templates to its own theme-chalk stylesheet', () => {
  assert.ok(elementTags.size >= 30, `模板里应当出现大量 Element Plus 标签，实际只有 ${elementTags.size} 个`);

  for (const [tag, files] of elementTags) {
    const styleName = tag.slice(3); // el-table-column -> table-column
    const styleEntry = path.join(elementPlusStyleRoot, `el-${styleName}.css`);
    assert.ok(
      fs.existsSync(styleEntry),
      `模板标签 <${tag}>（${[...files].join(', ')}）在 element-plus 里找不到对应的样式入口 el-${styleName}.css，` +
        '说明它不是 Element Plus 组件，resolver 不会给它注入样式'
    );
  }
});

test('declares on-demand styles for every explicitly imported Element Plus component and imperative API', () => {
  // 只有显式 import 才会被 resolver 跳过样式注入；模板标签由 resolver 负责。
  // 这里反过来：任何在本文件定义外显式 import 的 ElXxx，都必须在
  // element-plus-on-demand.js 或自己的样式依赖链里拿到样式。
  const scriptFiles = listFiles(srcRoot, (file) => /\.(vue|js|mjs)$/.test(file));
  const explicit = new Map();
  const pascalToKebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

  for (const file of scriptFiles) {
    if (file.endsWith('element-plus-on-demand.js')) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]element-plus['"]/g)) {
      for (const raw of match[1].split(',')) {
        const name = raw.trim();
        if (!name || name.startsWith('type ')) continue;
        if (!explicit.has(name)) explicit.set(name, new Set());
        explicit.get(name).add(path.relative(clientRoot, file));
      }
    }
  }

  assert.ok(explicit.size > 0, '应当仍然存在显式 import Element Plus 的调用点（命令式 API 必需）');

  for (const [name, files] of explicit) {
    // 指令与命令式 API 单独登记
    if (name === 'vLoading') {
      assert.match(
        onDemandStyleSource,
        /element-plus\/es\/components\/loading\/style\/css/,
        `vLoading（${[...files].join(', ')}）缺少按需样式`
      );
      continue;
    }
    assert.ok(name.startsWith('El'), `无法识别的显式 import：${name}（${[...files].join(', ')}）`);

    const styleName = pascalToKebab(name.slice(2));
    if (styleName === 'message' || styleName === 'message-box') {
      // 命令式 API：只有样式注册过才不会被 tree-shaking 掉
      assert.match(
        onDemandStyleSource,
        new RegExp(`element-plus/es/components/${styleName}/style/css`),
        `${name}（${[...files].join(
          ', '
        )}）是命令式 API，resolver 不会注入样式，必须在 element-plus-on-demand.js 中显式引入`
      );
      continue;
    }

    // 普通组件：要么自己有模板标签（resolver 管），要么在 on-demand 清单里显式补了样式
    const styleEntry = path.join(elementPlusStyleRoot, `el-${styleName}.css`);
    assert.ok(fs.existsSync(styleEntry), `${name} 在 element-plus 里没有 el-${styleName}.css`);

    if (elementTags.has(`el-${styleName}`)) continue; // 模板标签 → resolver 注入

    assert.match(
      onDemandStyleSource,
      new RegExp(`element-plus/es/components/${styleName}/style/css`),
      `${name}（${[...files].join(', ')}）只有显式 import、模板里没有同名标签，resolver 不会为它注入样式，` +
        '必须在 element-plus-on-demand.js 中显式引入'
    );
  }
});

test('keeps the Element Plus dark-mode variables and locale providers working', () => {
  // 暗黑模式变量必须保留（App.vue / themeStore 会切换 html.dark）
  assert.match(mainSource, /import\s*['"]element-plus\/theme-chalk\/dark\/css-vars\.css['"]/);
  // 全量样式不得回归
  assert.doesNotMatch(mainSource, /import\s*['"]element-plus\/dist\/index\.css['"]/);
  // ElConfigProvider 在两个入口使用，locale 从 element-plus/es/locale/lang/* 引入
  const appSource = read(srcRoot, 'App.vue');
  assert.match(appSource, /<el-config-provider\b/);
  assert.match(read(srcRoot, 'i18n/index.js'), /element-plus\/es\/locale\/lang\//);
});

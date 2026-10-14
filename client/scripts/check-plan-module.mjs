/**
 * 计划模块自检：静态结构核对 + SSR 冒烟渲染。
 *
 * 这个模块被拆成「页面 + 组件 + composable + 样式片段」之后，错误方式变得很安静：
 * 漏一个图标导入、少一个事件监听、样式片段拆错归属、composable 少返回一个状态，
 * 构建、lint、i18n 检查都不会报，只有真实浏览器里点到才发现。
 * 这个脚本把这些静默错误变成一条命令能不能过：
 *
 *   1. 未使用的导入
 *   2. 页面解构的状态与 composable 返回值是否对得上
 *   3. 子组件声明的事件是否都有父级监听（含 v-model → update:*）
 *   4. 模板里用到的类名是否有样式来源
 *   5. 样式里定义的类名是否还有人用（死样式）
 *   6. SSR 冒烟：渲染页面、列表、抽屉、两个页签、日期明细和四个弹窗，
 *      任何非白名单的 Vue 警告都算失败
 *
 * 用法：
 *   pnpm check:plan-module            全部检查
 *   pnpm check:plan-module -- --static  只跑静态检查（省掉 vite 启动）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
const plansDir = path.join(clientRoot, 'src/pages/plans');
const staticOnly = process.argv.includes('--static');

const problems = [];
const notes = [];
const fail = (check, message) => problems.push(`[${check}] ${message}`);

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

function listFiles(directory, matcher) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return listFiles(target, matcher);
      return matcher(target) ? [target] : [];
    })
    .sort();
}

const read = (file) => fs.readFileSync(file, 'utf8');
const relative = (file) => path.relative(clientRoot, file).replaceAll('\\', '/');

/** 拆出 vue 文件的三段，供后面按需扫描。 */
function splitVue(source) {
  const styleStart = source.indexOf('<style');
  const body = styleStart === -1 ? source : source.slice(0, styleStart);
  const style = styleStart === -1 ? '' : source.slice(styleStart);
  const templateStart = body.indexOf('<template>');
  const templateEnd = body.lastIndexOf('</template>');
  return {
    template: templateStart === -1 ? '' : body.slice(templateStart, templateEnd),
    script: body.slice(0, templateStart) + body.slice(templateEnd),
    style
  };
}

/** 选择器里的类名，可选地把 :deep() / :global() 里的第三方类排除在外。 */
function styleClassNames(css, { skipThirdParty = false } = {}) {
  // 先去掉注释：注释里出现的 `.scss`、`.el-dialog__body` 不是选择器。
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, ' ');
  const scoped = skipThirdParty ? withoutComments.replace(/:(deep|global)\([^)]*\)/g, ' ') : withoutComments;
  return new Set([...scoped.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]));
}

/** 模板里的静态类名；`:class` 是表达式，交给脚本那边单独扫。 */
function templateClassNames(template) {
  const withoutBindings = template.replace(/(?::class|v-bind:class)="[^"]*"/g, ' ');
  const found = new Set();
  for (const match of withoutBindings.matchAll(/class="([^"]*)"/g)) {
    for (const token of match[1].split(/\s+/)) if (/^[a-z][\w-]*$/.test(token)) found.add(token);
  }
  return found;
}

/** 脚本里拼出来的类名：'a--b' 字面量，以及 :class 对象里的键。 */
function scriptClassNames(script) {
  const found = new Set();
  for (const match of script.matchAll(/'([a-z][-\w]*--[-\w]+)'/g)) found.add(match[1]);
  for (const match of script.matchAll(/^\s*'([a-z][-\w]*)':/gm)) found.add(match[1]);
  return found;
}

const vueFiles = listFiles(plansDir, (file) => file.endsWith('.vue'));
const scriptFiles = listFiles(plansDir, (file) => file.endsWith('.js'));
const partialFiles = listFiles(path.join(plansDir, 'styles'), (file) => file.endsWith('.scss'));
const globalStyleFiles = listFiles(path.join(clientRoot, 'src/styles'), (file) => file.endsWith('.scss'));

/**
 * 有意不写样式的钩子类：要么样式由同时挂着的另一个类承担，要么由别的文件命中根节点。
 * 新增条目要写清原因，别把它当垃圾桶。
 */
const UNSTYLED_HOOK_CLASSES = new Set([
  'batch-session-dialog', // 只是弹窗钩子，样式在 batch-session-dialog__description 上
  'phase-review-dialog', // 同上，样式都在内部元素上
  'plan-phase-label', // 阶段名称那一行的钩子，暂未定义样式（历史遗留）
  'plan-review-content', // 与 phase-review-content 同时挂着，样式由后者承担
  'plan-review-summary' // 与 phase-review-summary 同时挂着，样式由后者承担
]);

// ---------------------------------------------------------------------------
// 1. 未使用的导入
// ---------------------------------------------------------------------------

function checkUnusedImports() {
  for (const file of [...vueFiles, ...scriptFiles]) {
    const source = read(file);
    const { template, script } = splitVue(source);
    // 多行命名导入也要完整取出来，不能按行判断 import 块结束。
    const statements = [...script.matchAll(/^import[\s\S]*?from\s+'[^']+';/gm)].map((match) => match[0]);
    const imports = statements.join('\n');
    let body = script;
    for (const statement of statements) body = body.replace(statement, '');
    body += `\n${template}`;
    const names = [];
    for (const match of imports.matchAll(/^import\s+(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))\s+from/gms)) {
      if (match[1]) {
        for (const part of match[1].split(',')) {
          const name = part
            .trim()
            .split(/\s+as\s+/)
            .pop();
          if (name) names.push(name);
        }
      } else if (match[2]) {
        names.push(match[2]);
      }
    }
    const unused = names.filter((name) => !new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`).test(body));
    if (unused.length) fail('未使用导入', `${relative(file)}: ${unused.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// 2. 页面解构 ↔ composable 返回值
// ---------------------------------------------------------------------------

/** 找到定义这个 composable 的文件；一个文件里可能有多个导出（例如 usePlanProgress / usePlanCoverage）。 */
function findComposableFile(name) {
  return scriptFiles.find((file) => read(file).includes(`export function ${name}(`)) || null;
}

/** 取该函数自己的 return { ... }：先切到函数体，再取里面最后一个对象字面量返回。 */
function composableReturnNames(file, name) {
  const source = read(file);
  const start = source.indexOf(`export function ${name}(`);
  if (start === -1) return null;
  const nextExport = source.indexOf('export function', start + 1);
  const body = source.slice(start, nextExport === -1 ? undefined : nextExport);
  const returns = [...body.matchAll(/return \{([\s\S]*?)\};/g)];
  const returned = returns[returns.length - 1];
  return returned
    ? returned[1]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : null;
}

function checkComposableContract() {
  for (const file of vueFiles) {
    const { script } = splitVue(read(file));
    // 页面级 composable 只为这一个页面服务，两边必须严格对齐；
    // 组件共用某个 composable 时只取一部分是正常的，不要求反向一致。
    const isPage = path.basename(file) === 'PlanOverviewPage.vue';
    for (const match of script.matchAll(/const \{([^{};]*?)\} = (use[A-Za-z]+)\(/g)) {
      const [, destructured, composable] = match;
      const composableFile = findComposableFile(composable);
      if (!composableFile) continue;
      const returnedNames = composableReturnNames(composableFile, composable);
      if (!returnedNames) {
        fail('composable 契约', `${relative(composableFile)}: 找不到 ${composable} 的 return 块`);
        continue;
      }
      const names = destructured
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
      const missing = names.filter((name) => !returnedNames.includes(name));
      if (missing.length) fail('composable 契约', `${relative(file)} 解构了未返回的: ${missing.join(', ')}`);
      if (!isPage) continue;
      const unused = returnedNames.filter((name) => !names.includes(name));
      if (unused.length) fail('composable 契约', `${relative(composableFile)} 返回了未解构的: ${unused.join(', ')}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. 事件绑定（子组件声明的每个事件都要有父级监听）
// ---------------------------------------------------------------------------

function checkEventBindings() {
  const sources = new Map();
  for (const file of vueFiles) sources.set(path.basename(file, '.vue'), read(file));

  for (const [name, source] of sources) {
    const { template } = splitVue(source);
    for (const match of template.matchAll(/<([A-Z][\w]*)\b([\s\S]*?)(\/>|>)/g)) {
      const [, child, attributes] = match;
      const childSource = sources.get(child);
      if (!childSource) continue;

      const declared = (childSource.match(/defineEmits\(\[([\s\S]*?)\]\)/) || [, ''])[1];
      const declaredEvents = [...declared.matchAll(/'([^']+)'/g)].map((item) => item[1]);
      if (declaredEvents.length === 0) continue;

      const bound = [...attributes.matchAll(/@([\w:-]+)=/g)].map((item) => item[1]);
      for (const match of attributes.matchAll(/v-model(?::([\w-]+))?=/g)) {
        const argument = match[1];
        bound.push(argument ? `update:${argument}` : 'update:modelValue');
      }
      const camelBound = bound.map((event) => event.replace(/-([a-z])/g, (_, char) => char.toUpperCase()));

      const unbound = declaredEvents.filter((event) => !bound.includes(event) && !camelBound.includes(event));
      if (unbound.length) fail('事件绑定', `${name} 里的 <${child}> 没监听: ${unbound.join(', ')}`);

      // 反向：监听了一个子组件根本没声明的事件，多半是拼错了事件名。
      const unknown = bound
        .map((event, index) => [event, camelBound[index]])
        .filter(([event, camel]) => !declaredEvents.includes(event) && !declaredEvents.includes(camel))
        .map(([event]) => event);
      if (unknown.length) fail('事件绑定', `${name} 里的 <${child}> 监听了未声明的事件: ${unknown.join(', ')}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. 模板类名是否有样式来源
// ---------------------------------------------------------------------------

function checkClassCoverage() {
  const available = new Set(UNSTYLED_HOOK_CLASSES);
  for (const file of [...vueFiles, ...partialFiles, ...globalStyleFiles]) {
    for (const name of styleClassNames(read(file))) available.add(name);
  }
  // 子组件根节点、grid-class 这类从 props 传下去的类名，样式在别处定义，这里一并算已覆盖。
  for (const file of vueFiles) {
    const { script } = splitVue(read(file));
    for (const match of script.matchAll(/^\s*'([a-z][-\w]*)':/gm)) available.add(match[1]);
  }

  for (const file of vueFiles) {
    const { template, script } = splitVue(read(file));
    const used = new Set([...templateClassNames(template), ...scriptClassNames(script)]);
    const missing = [...used].filter((name) => !available.has(name)).sort();
    if (missing.length) fail('类名覆盖', `${relative(file)} 用到的类没有样式来源: ${missing.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// 5. 死样式（定义的类名在模块里没人用）
// ---------------------------------------------------------------------------

function checkDeadStyles() {
  const usage = [];
  for (const file of [...vueFiles, ...scriptFiles]) {
    const source = read(file);
    const { template, script } = splitVue(source);
    usage.push(`${template}\n${script}`);
  }
  const usageText = usage.join('\n');
  const usagePrefixes = new Set(
    [...usageText.matchAll(/'([a-z][-\w]*--)'/g)]
      .map((match) => match[1])
      .concat([...usageText.matchAll(/return '([a-z][-\w]*--)/g)].map((match) => match[1]))
  );

  for (const file of [...vueFiles, ...partialFiles]) {
    const source = read(file);
    const css = file.endsWith('.vue') ? splitVue(source).style : source;
    const owned = styleClassNames(css, { skipThirdParty: true });
    const dead = [...owned]
      .filter((name) => !new RegExp(`(?<![\\w-])${name.replace(/-/g, '\\-')}(?![\\w-])`).test(usageText))
      .filter((name) => ![...usagePrefixes].some((prefix) => name.startsWith(prefix)))
      .sort();
    if (dead.length) fail('死样式', `${relative(file)} 定义了但没人用: ${dead.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// 6. SSR 冒烟
// ---------------------------------------------------------------------------

const ELEMENT_COMPONENTS = [
  'ElAlert',
  'ElButton',
  'ElCard',
  'ElCheckbox',
  'ElCheckboxGroup',
  'ElConfigProvider',
  'ElDatePicker',
  'ElDescriptions',
  'ElDescriptionsItem',
  'ElDialog',
  'ElDivider',
  'ElDrawer',
  'ElEmpty',
  'ElForm',
  'ElFormItem',
  'ElIcon',
  'ElInput',
  'ElInputNumber',
  'ElOption',
  'ElPagination',
  'ElPopconfirm',
  'ElRadioButton',
  'ElRadioGroup',
  'ElRate',
  'ElSegmented',
  'ElSelect',
  'ElSkeleton',
  'ElSkeletonItem',
  'ElStep',
  'ElSteps',
  'ElSwitch',
  'ElTable',
  'ElTableColumn',
  'ElTag',
  'ElTabPane',
  'ElTabs',
  'ElText',
  'ElTooltip',
  'ElUpload'
];

/** SSR 环境固有的噪声，与应用代码无关；其余警告一律当失败。 */
const IGNORED_WARNINGS = [
  'Custom directive is missing corresponding SSR transform', // v-loading 在 SSR 下没有对应实现
  'Feature flags __VUE_OPTIONS_API__',
  'has already been registered in target app', // 下面用同名桩件替换 Element Plus 的弹窗/抽屉
  'IdInjection',
  'ZIndexInjection',
  'elZIndexContextKey'
];

const exercises = [
  { id: 1, name: '俯卧撑', enabled: true, metrics: ['sets', 'repetitions'] },
  { id: 2, name: '平板支撑', enabled: true, metrics: ['duration'] },
  { id: 3, name: '慢跑', enabled: true, metrics: ['duration', 'distance', 'calories'] }
];

const plan = {
  id: 9,
  name: '2026年减重110KG',
  startDate: '2026-10-01',
  endDate: '2026-11-30',
  goal: '减重110kg,恢复心肺能力',
  notes: '备注',
  lifecycle: 'active',
  archived: false,
  adherence: {
    eligibleDays: 10,
    fulfilledDays: 7,
    extraDays: 1,
    completedDays: 7,
    rate: 0.7,
    tier: 'slight_shortfall'
  },
  extraTrainingDates: ['2026-10-08'],
  coverage: {
    verifiableItems: 6,
    matchedItems: 4,
    coverageRate: 0.67,
    achievedItems: 3,
    partialItems: 1,
    verifiableCompletionRate: 0.75
  },
  phases: [
    {
      id: 3,
      name: '恢复期',
      status: 'planned',
      startDate: '2026-10-01',
      endDate: '2026-11-30',
      description: '',
      adjustmentReason: '',
      review: null
    }
  ],
  sessions: [
    {
      id: 11,
      scheduledDate: '2026-10-05',
      status: 'planned',
      notes: '这天没练',
      items: [
        {
          id: 21,
          exerciseId: 1,
          exercise: { id: 1, name: '俯卧撑' },
          targets: { sets: 3, repetitions: 12 },
          execution: { status: 'achieved', actuals: { sets: 3, repetitions: 12 } }
        },
        {
          id: 22,
          exerciseId: 3,
          exercise: { id: 3, name: '慢跑' },
          targets: { durationSeconds: 1800, distance: 5, calories: 320 },
          match: {
            status: 'partial',
            progress: 0.6,
            ambiguous: true,
            candidateCount: 3,
            record: { durationSeconds: 1800, distanceMeters: 4200, calories: 300 },
            reason: 'record_missing_metrics'
          }
        }
      ]
    }
  ]
};

const reviewedPlan = {
  ...plan,
  lifecycle: 'ended',
  phases: [{ ...plan.phases[0], review: { summary: '总结', fatigueLevel: 8, discomfort: '膝痛', adjustment: '减量' } }]
};

const weightData = {
  dailyData: [
    { date: '2026-10-01', avgWeight: 110.5 },
    { date: '2026-10-31', avgWeight: 107.2 }
  ]
};

/**
 * Element Plus 的弹窗和抽屉在打开之前不渲染内容，SSR 拿不到内部模板。
 * 用同名桩件顶替，把 header/default/footer 插槽强制渲染出来。
 */
const StubDialog = defineComponent({
  name: 'ElDialog',
  props: { modelValue: { type: Boolean, default: false }, title: { type: String, default: '' } },
  setup(props, { slots }) {
    return () => {
      if (!props.modelValue) return null;
      return h('div', { class: 'stub-dialog', 'data-title': props.title }, [
        slots.header
          ? slots.header({ titleId: 'stub-title-id', titleClass: 'el-dialog__title' })
          : h('h2', props.title),
        slots.default ? slots.default() : null,
        slots.footer ? slots.footer() : null
      ]);
    };
  }
});

const StubDrawer = defineComponent({
  name: 'ElDrawer',
  props: { modelValue: { type: Boolean, default: false } },
  setup(props, { slots }) {
    return () => (props.modelValue ? h('div', { class: 'stub-drawer' }, slots.default ? slots.default() : null) : null);
  }
});

async function buildRouter(pathname) {
  const { createMemoryHistory, createRouter } = await import('vue-router');
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      { path: '/plans/overview', component: { render: () => null } }
    ]
  });
  router.push(pathname);
  await router.isReady();
  return router;
}

async function renderScenario(component, props, pathname) {
  const messages = [];
  const stringify = (value) => {
    try {
      return String(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  };
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = (...args) => messages.push(['warn', args.map(stringify).join(' ')]);
  console.error = (...args) => messages.push(['error', args.map(stringify).join(' ')]);
  try {
    const { createPinia } = await import('pinia');
    const ElementPlus = await import('element-plus');
    const { i18n } = await import('../src/i18n/index.js');
    const app = createSSRApp({ render: () => h(component, props) });
    app.use(createPinia());
    app.use(i18n);
    app.directive('loading', {});
    app.use(await buildRouter(pathname));
    for (const exportName of ELEMENT_COMPONENTS) {
      const registered = ElementPlus[exportName];
      if (registered) app.component(registered.name || exportName, registered);
    }
    app.component('ElDialog', StubDialog);
    app.component('ElDrawer', StubDrawer);
    return { html: await renderToString(app), messages };
  } catch (error) {
    return { html: '', messages: [...messages, ['throw', error?.stack || String(error)]] };
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
}

async function checkSmokeRender() {
  const { createServer } = await import('vite');
  const server = await createServer({
    root: clientRoot,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true }
  });

  const load = async (file) => (await server.ssrLoadModule(`/src/pages/plans/${file}`)).default;

  try {
    const [
      PlanOverviewPage,
      PlanListTable,
      PlanDetailDrawer,
      PlanCalendarTab,
      PlanCalendarDayDetail,
      PlanReviewTab,
      PlanFormDialog,
      SessionFormDialog,
      BatchSessionDialog,
      PhaseReviewDialog
    ] = await Promise.all([
      load('PlanOverviewPage.vue'),
      load('components/PlanListTable.vue'),
      load('components/PlanDetailDrawer.vue'),
      load('components/PlanCalendarTab.vue'),
      load('components/PlanCalendarDayDetail.vue'),
      load('components/PlanReviewTab.vue'),
      load('components/PlanFormDialog.vue'),
      load('components/SessionFormDialog.vue'),
      load('components/BatchSessionDialog.vue'),
      load('components/PhaseReviewDialog.vue')
    ]);

    const scenarios = [
      [
        '计划总览页',
        PlanOverviewPage,
        {},
        '/plans/overview',
        ['plan-manager', 'plan-content-header', 'plan-table-region']
      ],
      ['计划总览页（?planId=）', PlanOverviewPage, {}, '/plans/overview?planId=9', ['plan-table-region']],
      [
        '计划列表',
        PlanListTable,
        { plans: [plan, reviewedPlan], selectedPlanId: 9, showArchived: false },
        '/',
        ['plan-table-region']
      ],
      [
        '详情抽屉-进行中',
        PlanDetailDrawer,
        { modelValue: true, plan, weightData, loading: false },
        '/',
        ['plan-detail-header', 'plan-calendar-section', 'calendar-day-detail']
      ],
      [
        '详情抽屉-已结束有反馈',
        PlanDetailDrawer,
        { modelValue: true, plan: reviewedPlan, weightData },
        '/',
        ['plan-review-card', 'phase-review-content', 'plan-goal']
      ],
      ['训练日历页签', PlanCalendarTab, { plan }, '/', ['plan-calendar-section', 'calendar-workspace']],
      [
        '训练单元明细',
        PlanCalendarDayDetail,
        {
          scheduledDate: '2026-10-05',
          sessions: plan.sessions,
          selectedSession: plan.sessions[0],
          inPlan: true,
          canBackfill: true
        },
        '/',
        ['calendar-backfill', 'session-item__actual', 'session-item__match-hint', 'calendar-session-notes']
      ],
      [
        '计划反馈页签',
        PlanReviewTab,
        { plan: reviewedPlan, weightData },
        '/',
        ['plan-review-card', 'phase-review-content']
      ],
      ['计划反馈页签-未填写', PlanReviewTab, { plan, weightData }, '/', ['plan-review-card', 'el-empty']],
      [
        '计划弹窗-新建',
        PlanFormDialog,
        { modelValue: true, plan: null, exercises, saving: false },
        '/',
        ['plan-creation-steps', 'batch-rule', 'plan-draft-sessions']
      ],
      [
        '训练课弹窗-编辑',
        SessionFormDialog,
        {
          modelValue: true,
          session: {
            id: 11,
            scheduledDate: '2026-10-05',
            status: 'planned',
            notes: '备注',
            items: [
              { exerciseId: 1, targets: { sets: 3, repetitions: 12 } },
              { exerciseId: 2, targets: {}, durationParts: { hours: 0, minutes: 1, seconds: 30 } }
            ]
          },
          exercises
        },
        '/',
        ['session-item-card__number', 'session-card-target', 'training-duration-input']
      ],
      [
        '批量加课弹窗',
        BatchSessionDialog,
        { modelValue: true, plan: null, exercises, saving: false },
        '/',
        ['batch-session-fields', 'session-items-table']
      ],
      [
        '阶段复盘弹窗',
        PhaseReviewDialog,
        { modelValue: true, phase: reviewedPlan.phases[0], planName: plan.name },
        '/',
        ['fatigue-rating-field', 'fatigue-high-alert']
      ]
    ];

    for (const [name, component, props, pathname, markers] of scenarios) {
      const { html, messages } = await renderScenario(component, props, pathname);
      const unexpected = messages.filter(([, text]) => !IGNORED_WARNINGS.some((ignored) => text.includes(ignored)));
      for (const [kind, text] of unexpected) {
        fail('SSR 冒烟', `${name} 出现${kind === 'throw' ? '异常' : '警告'}: ${text.split('\n')[0].slice(0, 200)}`);
      }
      const missing = markers.filter((marker) => !html.includes(marker));
      if (missing.length) fail('SSR 冒烟', `${name} 渲染结果缺少: ${missing.join(', ')}`);
      if (!unexpected.length && !missing.length) notes.push(`${name}（${html.length}B）`);
    }
  } finally {
    await server.close();
  }
}

// ---------------------------------------------------------------------------
// 执行
// ---------------------------------------------------------------------------

const checks = [
  ['未使用导入', checkUnusedImports],
  ['composable 契约', checkComposableContract],
  ['事件绑定', checkEventBindings],
  ['类名覆盖', checkClassCoverage],
  ['死样式', checkDeadStyles]
];

for (const [name, check] of checks) {
  const before = problems.length;
  check();
  if (problems.length === before) notes.push(name);
}

if (!staticOnly) await checkSmokeRender();
else notes.push('SSR 冒烟（已跳过）');

if (problems.length) {
  console.error(`[plan-module] ${problems.length} 处问题：`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`[plan-module] ${staticOnly ? '静态检查' : '静态检查 + SSR 冒烟'}通过：${notes.join(' / ')}`);

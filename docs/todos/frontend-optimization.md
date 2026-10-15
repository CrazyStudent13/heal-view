# 前端优化待办

这份清单用于记录 Heal View 的前端优化方向。2026-09-13 阶段性前端优化已告一段落；未完成条目保留为后续需求确认后的工程事项，不在当前版本继续扩展。

## 本轮已完成

- [x] 页面路由级懒加载，降低首屏入口脚本体积，并避免登录页初始化仪表盘布局。
- [x] 复用短时间内的认证状态请求，减少重复鉴权请求。
- [x] 日期列表汇总请求改为限量并行批处理，缩短历史日期较多时的等待时间。
- [x] 图表 ECharts 实例、Resize 监听、延迟初始化任务和异步回调增加卸载清理。
- [x] 增加统一异步状态组件，开始收敛 loading、empty、error 的展示方式。
- [x] 移除 Element Plus 图标全量注册，改为组件级按需导入。
- [x] 保持 ECharts core 按需注册，并结合图表懒加载避免登录页加载图表资源。
- [x] 日期列表请求增加短时缓存、并发复用和强制刷新取消，避免侧栏与看板初始化重复请求。
- [x] 侧栏日期列表接入统一 loading、empty、error、retry 状态，并把日期请求错误纳入看板上下文。
- [x] 报告、计划和关于页面复用统一页面容器，减少重复外层布局样式。
- [x] 导航、视图切换、日期和指标卡补充键盘操作及基础 ARIA 语义。
- [x] Element Plus 改为显式组件注册，移除全量插件注册，降低首屏入口体积。（2026-10-15 第十八阶段已进一步改为 resolver 按需引入，连显式注册清单也一并移除。）

## 优先级说明

- **P0**：影响使用体验、稳定性或后续开发效率，应优先处理。
- **P1**：能明显改善性能、可维护性或交互体验。
- **P2**：体验增强或结构性改进，可结合功能迭代推进。

## P0：基础体验与稳定性

- [ ] 梳理全局页面加载、接口加载、空数据和错误状态，统一反馈方式。（Dashboard、日期侧栏、筛选、个人配置、报告/计划、导入历史和图表外层已接入；图表内部与导入流程提示仍待继续收敛。）
- [ ] 检查窄屏和小窗口下的布局，重点关注顶部导航、日期选择器、图表和个人配置页。（个人配置、指标卡、页面容器、顶部导航、视图切换和日期侧栏已增加窄屏布局；真实看板页面受访问验证阻挡，仍待浏览器检查。）
- [ ] 为路由页面补充基础级别的组件测试或页面行为测试。（已为异步请求状态补充单元测试，页面级测试仍待测试工具链落地。）
- [ ] 清理页面中的硬编码文案，确保新增功能完整接入中英文国际化。（页面、导入模块、路由标题和认证 fallback 已接入；仅剩注释与领域兼容输入判断。）
- [ ] 统一按钮、表单、卡片、标题和间距的视觉规范，减少页面之间的样式差异。（已新增卡片阴影、控件边框、hover/active 背景等语义 token，并迁移顶部导航、视图切换、日期侧栏和看板侧栏；导入流程与复杂图表内部样式仍待继续收敛。）

## P1：性能与资源加载

- [x] 按路由拆分页面和较重组件，减少首屏 JavaScript 体积。
- [x] 评估 ECharts 按需引入和图表组件加载策略，降低初始加载成本。
- [x] 检查图表监听器、定时器和请求的生命周期，避免路由切换后继续占用资源。
- [x] 为日期切换、筛选和多日对比增加请求去重、取消过期请求或合理缓存。
- [x] 检查生产构建产物体积，建立一次构建体积记录，后续用数据判断优化收益。

## P1：组件与状态管理

- [ ] 提取页面中重复的筛选、日期选择、加载和错误处理逻辑。（日期列表、页面容器、报告/计划空状态已接入公共组件；筛选与更多图表内部状态仍待收敛。）
- [x] 梳理 Pinia store 的职责，区分服务端数据、页面状态和纯 UI 状态。
- [ ] 为图表组件统一数据输入、空状态、主题切换和窗口尺寸响应接口。（已新增 ECharts 生命周期/主题色 composable 并迁移部分图表；数据输入与剩余图表仍待继续收敛。）
- [x] 减少跨层级样式覆盖，明确全局样式、布局样式和组件局部样式的边界。
- [x] 评估个人配置、导入、报告等页面是否需要统一的页面容器组件。

## P2：交互与可访问性

- [x] 补充键盘操作、焦点状态和表单错误提示。（导航、日期项、指标卡和视图切换支持键盘操作；登录和访问保护校验失败后聚焦错误字段。）
- [x] 检查图标按钮的 aria-label、链接打开方式和颜色对比度。（图标按钮已有可访问名称，装饰图标从可访问树隐藏；外链声明新窗口行为；浅色主题语义色提升对比度。）
- [x] 优化移动端的导航、筛选器和图表横向浏览体验。（页面容器、指标卡、日期侧栏和导航已有窄屏约束；图表区域在小屏支持键盘聚焦及横向滚动。）
- [x] 为关键图表补充可读的摘要或表格化信息，降低仅依赖视觉图表的门槛。（多日步数、热量、心率、睡眠和体重图表提供可展开的本地化数据表。）
- [x] 增加用户偏好记忆，例如最近使用的语言、主题、日期范围和视图模式。（语言、主题、视图模式、日期和对比范围已持久化；跨设备同步不在本地前端范围内。）

## P2：工程质量

- [x] 引入前端代码格式和静态检查，并接入提交前或 CI 检查。（根目录提供 Prettier/ESLint 脚本，GitHub Actions 在 push 和 pull request 中执行格式、静态检查、i18n、测试和客户端构建。）
- [ ] 建立关键页面的桌面端和移动端截图基线。
- [ ] 为健康规则、数据格式化和图表数据转换补充边界测试。
- [ ] 记录每次优化的动机、改动范围、验证方式和结果。

## 建议推进顺序

1. 先完成全局状态、响应式布局和国际化清理，建立一致的使用基础。
2. 再处理路由拆分、ECharts 资源和请求生命周期，降低性能风险。
3. 接着收敛组件与状态管理，减少后续功能开发成本。
4. 最后持续补充可访问性、工程检查和性能基线。

## 阶段结论

本轮已完成页面异步反馈、请求生命周期、路由拆分、图表资源治理、国际化清理、组件状态收敛、交互与可访问性，以及前端格式化和静态检查接入。当前暂缓的事项只有截图基线、页面级浏览器行为测试和更多边界测试，待具体需求和验收标准明确后再推进。

## 每项优化的验收记录

后续完成条目时，建议在对应提交或版本记录中补充：

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 解决什么问题，面向哪些页面 |
| 实现方式 | 涉及的组件、store、路由或构建配置 |
| 验证方式 | 测试、构建、浏览器检查或性能数据 |
| 结果 | 是否达到预期，是否有遗留问题 |

## 2026-09-13 第二阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 统一日期列表异步反馈，避免重复请求，减少重复页面容器，并改善窄屏和键盘使用体验 |
| 实现方式 | `dateStore` 增加 30 秒缓存、并发请求复用和 `AbortController` 取消；侧栏复用 `AsyncState`；新增 `PageContainer`；导航、指标卡和日期项补充 ARIA 与键盘交互；报告、计划文案接入中英文国际化 |
| 验证方式 | `pnpm test`、`pnpm --dir client check:i18n`、`pnpm build:client` |
| 结果 | 测试与构建通过；后续继续处理导入页国际化和全局组件异步状态 |

## 2026-09-13 构建体积记录

| 项目 | 优化前 | 优化后 | 结果 |
| --- | ---: | ---: | --- |
| 生产主入口 JS | 715.24 kB | 138.13 kB | 移除 `app.use(ElementPlus)` 全量注册，改为显式注册实际使用组件 |
| ECharts vendor chunk | 612.02 kB | 612.02 kB | 保持独立按需 chunk，未影响图表资源策略 |
| 构建告警 | 有 | 无 | `pnpm build:client` 通过且不再出现 chunk 超限警告 |

## 2026-09-13 第三阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 收敛导入模块国际化，并为共享异步状态和图表区域增加可验证的可访问性基础 |
| 实现方式 | 导入页可见文案、状态文案、确认提示和错误提示全部改为 i18n；路由标题和认证 fallback 改用 i18n；新增异步请求生命周期单元测试；`ChartDisplay` 增加 region、动态 aria-label 和 aria-busy |
| 验证方式 | `pnpm test`、`pnpm check:i18n`、`pnpm build:client` |
| 结果 | 421 个 i18n key 校验通过；测试与构建通过；仅保留少量注释/领域兼容字符串，页面级浏览器测试尚未建立 |

## 2026-09-13 第四阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 记忆常用筛选视图，改善个人配置窄屏布局，并统一指标侧栏空态反馈 |
| 实现方式 | `dateStore` 持久化视图模式、单日日期、多日日期和范围；移除顶部导航未实际生效的 `v-model`；个人配置移动端改为纵向布局；个人数据视图和指标侧栏复用 `AsyncState`；增加 `prefers-reduced-motion` 样式 |
| 验证方式 | `pnpm test`、`pnpm test:client`、`pnpm check:i18n`、`pnpm build` |
| 结果 | 测试、i18n 检查和构建通过；主入口约 138.45 kB；真实浏览器截图与页面行为测试仍待建立 |

## 2026-09-13 第五阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 统一个人配置、导入、报告和计划页面的卡片页面容器，减少重复外层样式并保持标题栏高度一致 |
| 实现方式 | 扩展 `PageContainer` 的卡片模式、统一 82px 标题栏、actions 和内容区尺寸；导入历史、报告、计划和个人配置页复用页面容器/卡片外壳；关于页移除嵌套页面容器 |
| 验证方式 | `pnpm test`、`pnpm --filter heal-view-client check:i18n`、`pnpm --filter heal-view-client build` |
| 结果 | 测试、i18n 检查和构建通过；真实浏览器截图基线仍待建立 |

## 2026-09-13 第六阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 推进组件与状态管理收敛，减少图表生命周期重复、统一页面空状态，并明确 store 与样式边界 |
| 实现方式 | 新增 `useEchartsInstance` 统一 ECharts 初始化、resize、销毁和主题色；迁移卡路里、压力、多日对比、时间序列和个人 BMI 图表；报告/计划页复用 `AsyncState` 空状态；全局页面表面样式移入 `components.scss`；新增前端状态边界文档 |
| 验证方式 | `pnpm test`、`pnpm --filter heal-view-client check:i18n`、`pnpm --filter heal-view-client build` |
| 结果 | 20 个测试、i18n 检查和生产构建通过；剩余较复杂图表的数据输入与内部状态接口仍待继续收敛 |

## 2026-09-13 第七阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 回到 P0 基础体验，继续统一页面入口视觉规范，并收敛图表外层和导入历史空/错状态 |
| 实现方式 | 新增 `--card-shadow`、`--control-border`、`--control-hover-bg`、`--success-light`、`--danger-light` 等视觉 token；顶部导航、视图切换、日期侧栏和看板侧栏迁移到 token/公共卡片样式；`ChartDisplay` 错误与空态、导入历史空态复用 `AsyncState` |
| 验证方式 | `pnpm test`、`pnpm --filter heal-view-client check:i18n`、`pnpm --filter heal-view-client build`；启动 Vite 后用浏览器打开本地页面 |
| 结果 | 测试、i18n 检查和构建通过；本地浏览器可打开登录页，但看板真实窄屏检查受访问验证阻挡，仍需测试密码或临时关闭访问保护后继续 |

## 2026-09-13 第八阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 继续清理国际化残留，让语言切换覆盖语言选项、日期/数字格式、图表单位和通用网络错误 |
| 实现方式 | locale 增加按当前语言工作的日期、时间和数字格式化工具；语言选项名称改为翻译 key；日期选择器、日期侧栏和导入历史使用本地化格式；图表与指标卡统一从单位字典取值；请求错误增加 `messageKey`，超时、网络和通用失败可按当前语言显示；导入结果的连接符也纳入 locale |
| 验证方式 | `pnpm test`、`pnpm test:client`、`pnpm --filter heal-view-client check:i18n`、`pnpm build:client`、`git diff --check` |
| 结果 | 全量测试 21 项、客户端测试 20 项、i18n key 校验 443 个和生产构建均通过；`git diff --check` 无错误 |

## 2026-09-13 第九阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 继续收敛复杂图表和运动详情中的国际化显示，避免英文界面混入中文连接符、固定单位和 ISO 日期 |
| 实现方式 | 运动详情的距离、速度、步频、划频、身高、步幅和海拔单位改为 locale 参数；睡眠阶段图的 REM、小时单位和 tooltip 使用翻译；多日图表横轴统一使用本地化日期；个人数据、卡路里和心率 tooltip 统一使用 locale 单位与连接符 |
| 验证方式 | `pnpm test`、`pnpm --filter heal-view-client check:i18n`、`pnpm build:client`、`git diff --check` |
| 结果 | 全量测试 21 项、i18n key 校验 447 个和生产构建均通过；`git diff --check` 无错误 |

## 2026-09-13 第十阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 收口 P2 交互与可访问性待办，改善键盘操作、错误定位、颜色对比和图表的非视觉访问方式 |
| 实现方式 | 登录和访问保护表单在校验失败后聚焦错误字段；导航装饰图标隐藏语义；外链补充新窗口提示；浅色主题语义色提高对比度；关键多日图表增加可展开数据表；小屏图表支持聚焦和横向滚动 |
| 验证方式 | `pnpm test:client`、`pnpm --filter heal-view-client check:i18n`、`pnpm build:client`、`git diff --check` |
| 结果 | 23 个客户端测试、457 个 i18n key 校验和生产构建通过；P2 交互与可访问性清单完成，后续截图基线归入工程质量待办 |

## 2026-09-13 第十一阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 建立前端格式化和静态检查入口，并让 CI 在合并前执行基础质量门禁 |
| 实现方式 | 增加 ESLint flat config、Prettier 配置和根目录 `format`/`format:check`/`lint` 脚本；通过 Husky + lint-staged 在提交前只格式化暂存文件；新增 GitHub Actions workflow，串联格式、静态检查、i18n、测试和客户端构建 |
| 验证方式 | `pnpm format:check`、`pnpm lint`、`pnpm check:i18n`、`pnpm test`、`pnpm build:client` |
| 结果 | 本地质量检查全部通过；现有遗留代码的非阻断风格告警已关闭或降为不影响退出码的规则，后续新增代码可逐步收紧规则 |

## 2026-10-14 第十二阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 拆分 3878 行的计划总览页：把四个弹窗及其交互拆成独立组件，让单文件回到可读规模 |
| 实现方式 | 新增 `pages/plans/components/` 下的 `PlanFormDialog`、`PlanBatchRuleEditor`、`SessionFormDialog`、`BatchSessionDialog`、`PhaseReviewDialog` 和共用的 `TrainingItemTargets`；共用逻辑抽到 `pages/plans/composables/`（`useTrainingItemEditor`、`useChinaCalendar`、`usePlanLabels`）；弹窗共用样式片段放 `pages/plans/styles/_dialogShared.scss`；写库请求留在页面，弹窗用 `submit` 上报载荷；同时删除计划页中已经不存在的旧阶段结构样式 |
| 验证方式 | `pnpm lint`、`pnpm --filter heal-view-client build`、`node --test tests/client/index.test.js`，并用临时 SSR 冒烟脚本渲染页面与四个弹窗，核对无运行时错误和 Vue 警告 |
| 结果 | 计划总览页 3878 → 2009 行，弹窗与共用逻辑拆到 10 个新文件；静态检查、构建和 35 项客户端测试通过；未做真实浏览器的视觉核对 |

## 2026-10-14 第十三阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 继续拆分计划总览页：把详情抽屉、训练日历、日期明细、计划反馈和计划列表也拆成组件，并修掉上一轮误删的抽屉头部对齐规则 |
| 实现方式 | 新增 `pages/plans/components/` 下的 `PlanListTable`、`PlanDetailDrawer`、`PlanCalendarTab`、`PlanCalendarDayDetail`、`PlanReviewTab`；达成度、覆盖率与百分比格式化收敛到 `usePlanProgress`，训练日历的月份/选中日期/格子收敛到 `usePlanCalendar`，生命周期标签并入 `usePlanLabels`；恢复 `.plan-detail-header` 的 `justify-content: space-between`（上一轮清理死样式时与 `.phase-header` 一起被删掉，导致详情头部四个按钮贴住标题）；`tests/client/trainingExercise.test.js` 的源码断言改为读取整个 plans 模块，不再绑死单个文件 |
| 验证方式 | `pnpm lint`、`pnpm --filter heal-view-client build`、`node --test tests/client/index.test.js`、`pnpm --filter heal-view-client check:i18n`，并用临时 SSR 冒烟脚本渲染 12 个场景（页面、列表、抽屉两态、日历页签、日期明细、反馈页签两态、四个弹窗） |
| 结果 | 计划总览页 2009 → 415 行，计划模块共 21 个文件、单个文件最大 476 行；冒烟过程中发现并修复抽屉缺少图标导入（编辑/归档/新增训练单元/删除四个按钮图标不显示）的问题；静态检查、构建、i18n 和 35 项客户端测试通过；视觉仍建议在真实浏览器里过一遍 |

## 2026-10-14 第十四阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 把计划总览页剩下的数据层也搬出去，让页面回到「薄视图」：只接状态、渲染组件 |
| 实现方式 | 新增 `pages/plans/composables/usePlanWorkspace.js`，按 `useImportWorkflow` 的既有模式集中页面状态（列表、详情、体重数据、弹窗开关、加载与保存中状态）、接口调用（计划/训练单元/阶段/反馈的增删改查）、`?planId=` 深链打开抽屉、列表错误提示和特殊错误码处理，并自己 `onMounted` 拉取；页面只解构这个 composable 并把状态接到组件上 |
| 验证方式 | `pnpm lint`、`pnpm --filter heal-view-client build`、`node --test tests/client/index.test.js`、`pnpm --filter heal-view-client check:i18n`，SSR 冒烟脚本扩到 13 个场景（新增带 `?planId=` 的总览页） |
| 结果 | 计划总览页 415 → 172 行（模板 73 行、脚本 50 行、样式 48 行），计划模块 22 个文件；页面不再直接依赖 `fitnessApi`，数据与交互集中在 `usePlanWorkspace`；静态检查、构建、i18n 和 35 项客户端测试通过；仍未做真实浏览器视觉核对 |

## 2026-10-14 第十五阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 拆开计划弹窗的共用样式片段：它同时装了 scoped 表单规则和一段全局的 `.session-dialog` 滚动样式，前者被 4 个弹窗各存一份、后者根本不该由不拥有该弹窗的组件输出 |
| 实现方式 | `_dialogShared.scss` 只留四个弹窗都用的通用规则（`h3/h4/p` 归零、`.full-width`）；新增 `_itemForm.scss` 装训练项目编辑表单规则（`.exercise-select`、`.training-items-heading`、`.weekday-options`、`.calendar-notice`），由三个训练项目弹窗引入；新增 `_sessionDialogScroll.scss` 装 `:global(.session-dialog ...)` 的滚动与滚动条规则，只由 `SessionFormDialog`、`BatchSessionDialog` 引入；`PlanFormDialog` 不再引入训练项目规则 |
| 验证方式 | `pnpm lint`、`pnpm --filter heal-view-client build`、`node --test tests/client/index.test.js`、`check:i18n`，并核对构建产物里选择器的副本数（`.full-width` 4 份、训练项目规则 3 份、全局滚动规则 1 份）和计划页 CSS chunk 体积 |
| 结果 | 计划页 CSS chunk 31060 → 30588 字节（-472）；全局滚动规则仍只有一份（打包会去重），训练课弹窗滚动行为不变；顺带修正了上一轮记录里夸大的重复占比（实际约 2%，之前把会被去重的全局规则也算成了重复）；静态检查、构建、i18n 和 35 项客户端测试通过 |

## 2026-10-14 第十六阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 把这次拆分中靠临时脚本做的核对固化下来：漏图标导入、漏事件监听、样式归属拆错、composable 少返回状态、类名写错这几类问题，构建、lint、i18n 和现有测试都发现不了，只在真实浏览器里点到才暴露 |
| 实现方式 | 新增 `client/scripts/check-plan-module.mjs`（`pnpm check:plan-module`）：未使用导入、页面解构 ↔ composable 返回值、子组件声明的事件是否都有监听（含 `v-model` → `update:*`）、模板类名是否有样式来源、样式类名是否还有使用方，最后用 SSR 渲染 13 个场景（页面两态、列表、抽屉两态、两个页签、日期明细、四个弹窗）并把非白名单的 Vue 运行时警告当失败；`--static` 跳过 SSR 只做结构核对。新增 `tests/client/planModule.test.js` 把静态部分接进 `pnpm test`，不需要改 CI workflow 就能被质量门禁覆盖 |
| 验证方式 | 反向注入七类错误（漏图标导入、模板类名写错、父级漏监听、多返回一个没人用的状态、少返回一个被解构的状态、留下死样式、留下未使用的导入）逐个确认检查器都会红并给出可读提示；确认 `tests/client/planModule.test.js` 能红能绿；再跑 `pnpm lint`、`pnpm test`、`pnpm test:server`、`pnpm check:i18n`、`pnpm build:client`、`pnpm check:plan-module` |
| 结果 | 模块结构回归从"靠人记着"变成一条命令；SSR 冒烟覆盖页面、列表、抽屉、页签、日期明细和四个弹窗，能抓到"图标没导入"这类只在运行时出现的警告；仍需 vite 的 SSR 部分没有进 CI，需要时可以按同样方式加一步 |

## 2026-10-15 首屏体积记录

沿用 2026-09-13 的口径：首屏 = `dist/index.html` 里直接引用与 `modulepreload` 的资源，gzip 为 level 9。

| 项目 | 优化前 | 优化后 | 结果 |
| --- | ---: | ---: | --- |
| 首屏合计 gzip | 379.2 kB | 204.1 kB | 累计 −46%；raw 1340.3 → 654.0 kB |
| 首屏入口 CSS gzip | 50.1 kB | 18.2 kB | 移除 `element-plus/dist/index.css` 全量样式，改按需注入 |
| Vant（JS+CSS）gzip | 88.7 kB（在首屏） | 0（懒加载） | Vant 只服务 `/m`，不再被桌面端首屏静态引用 |
| Element Plus Table gzip | 48.3 kB（在首屏） | 0（懒加载） | 只在数据页按需加载 |
| ECharts chunk | 612.02 kB | 612.02 kB | 保持独立懒加载 chunk，始终不在首屏 |

## 2026-10-15 第十七阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | 桌面端首屏无条件加载只服务 `/m` 的 Vant（JS 52.0 + CSS 36.7 = 88.7 kB gzip），且找不到原因 |
| 实现方式 | 根因有两处：① `vite.config.js` 的 `manualChunks` 只匹配 `node_modules/vue`，漏掉 `@vue/*` 作用域包，Rollup 把 Vue 运行时（`@vue/shared`、`@vue/reactivity`、`@vue/runtime-core`、`@vue/runtime-dom`）并进了 `vendor-vant` 分块，而入口需要 Vue 运行时，于是整个 Vant 分块变成首屏静态依赖（已 dump 分块模块清单确认：该分块 = 4 个 `@vue/*` 模块 + 140 个 Vant 模块）；② `router/index.js` 静态引入了唯一在首屏消费 Vant 的 `MobileLayout`。改为不手工划分 vendor 分块（交给 Rollup 按真实动静依赖图切分），并把 `MobileLayout` 改为懒加载 |
| 验证方式 | 逐个对比两种分块策略的首屏 gzip；核对产物 `index.html` 的 modulepreload 列表；用仓库已有 Vite SSR 套路渲染移动端组件树（`TrainingPage` 仍带 Vant 正常渲染 1710 B、0 报错）；`pnpm test` / `pnpm lint` / `check:i18n` / `check:plan-module` |
| 结果 | 首屏 gzip 379.2 → 322.4 kB（−14.9%），raw 1340.3 → 1186.6 kB；ECharts 仍是独立懒加载 chunk；已实测"只补 `@vue/` 规则"或"开启 `onlyExplicitManualChunks`"都无法阻止该合并，所以直接不手工分块。`MobileLayout` / `MobileSettingsPage` 无法 SSR 冒烟（`themeStore` 在创建时调用 `document.documentElement`），这是既有浏览器专用副作用，与本次改动无关 |

## 2026-10-15 第十八阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | `main.js` 全量 `import 'element-plus/dist/index.css'`（376 kB raw / 50.1 kB gzip）覆盖全部组件，而实际只用 39 种标签；同时 38 个组件的批量全局注册把 `ElTable`（48.3 kB gzip）等拉进首屏 |
| 实现方式 | ① 移除全量样式与批量全局注册，模板里的 `<el-*>` 交给 `ElementPlusResolver` 按需注入「组件 + 样式」；② 新增 `src/styles/element-plus-on-demand.js` 补齐 resolver 看不到的三类用法——命令式 API（`ElMessage` / `ElMessageBox`）、指令（`v-loading`）、显式 import 的组件，暗黑模式变量仍整包引入；③ `Components` 不再用 `include` 限定扫描范围（那会连 Element Plus 一起挡掉），改为同时启用 `VantResolver` 与 `ElementPlusResolver`，并新增 `enforceVantScope` 护栏补回「Vant 只作用于移动端」——该护栏做两道检查：`transform` 拦源码里显式写的 `from 'vant'`，`resolveId` 拦 resolver 注入的 `from 'vant'`（注入发生在 transform 之后，只有 `resolveId` 能拿到 importer）；④ `check-plan-module.mjs` 适配：把 `element-plus/es` 别名到虚拟模块以替换 `ElDialog`/`ElDrawer` 桩件（resolver 注入的本地 import 优先于 `app.component` 全局注册，原全局桩件会被绕过），该虚拟模块必须 `export * from 'element-plus/es/index.mjs'`，写成 `'element-plus/es'` 会被别名指回自己、所有具名导出变成 undefined |
| 验证方式 | 新增 `tests/client/elementRegistration.test.js` 守卫（模板里每个 `<el-*>` 逐个对照 `theme-chalk` 样式入口；每个显式 import 的组件/命令式 API 必须在 on-demand 清单里登记）；`tests/client/mobileTooling.test.js` 直接取 `vite.config.js` 注册的护栏插件做正反向验证（含 `mobileBackup` 这种前缀相同的目录必须被拒）；新增 `scripts/check-element-plus-styles.mjs` 从 dist 产物反向核对样式存在性，并反向确认 13 个未使用组件的样式没有被打进产物；`pnpm test` / `test:client`(40) / `test:server`(83) / `lint` / `check:i18n` / `check:plan-module` / `build:client` / `format:check` |
| 结果 | 首屏 gzip 322.4 → 204.1 kB，入口 CSS 50.1 → 18.2 kB gzip，`ElTable` 离开首屏；`check:element-styles` 结论"全部通过"（含未使用组件无残留、`html.dark` 变量在位）。**这是最容易静默回归的一次改动**：lint、i18n、以及 `check-plan-module` 的 SSR 冒烟都发现不了"组件在、样式没了"（该冒烟是自己手工全局注册组件的），所以把核对固化成了上面两条自动化守卫 |

## 2026-10-15 第十九阶段记录

| 项目 | 内容 |
| --- | --- |
| 优化目标 | CI 的 `pnpm test` 长期漏跑大部分测试，导致新增守卫形同虚设 |
| 实现方式 | `tests/index.test.js` 原本是一份手写清单，只列了 10 个文件，而 `tests/client` 与 `tests/server` 下共有 26 个测试文件。改为直接引入两个子聚合文件，以后新增测试只要挂到子目录 `index` 上就会被跑到。同时在 `quality.yml` 的 `build` 之后增加 `check:element-styles` 步骤 |
| 验证方式 | `pnpm test` 由 38 项提升到 123 项（= client 40 + server 83），0 失败；`pnpm format:check` |
| 结果 | 补回 16 个文件、约 81 项用例，其中包含整个训练计划域（`trainingPlanCrud` / `trainingPlanAdherence` / `trainingExecution` / `aerobicMatching` / `planAdherence` / `trainingPlanValidation`）与本次新增的 `elementRegistration` / `mobileTooling` / `planModule` 守卫。漏跑确实掩盖过问题：第十八阶段打破 `elementRegistration` 的断言时 CI 完全看不到，本地 `pnpm test:client` 才发现 |


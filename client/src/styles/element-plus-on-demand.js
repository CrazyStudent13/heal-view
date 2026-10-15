/**
 * Element Plus 命令式 API / 显式 import 的按需样式补丁。
 *
 * 背景：`unplugin-vue-components` + `ElementPlusResolver` 只会给**模板里以标签形式出现**
 * 的 `<el-*>` 组件注入样式。以下三类用法不经过模板标签，resolver 看不到，因此必须在这里
 * 显式声明它们的样式，否则移除全量 `element-plus/dist/index.css` 后会出现"有功能、没样式"：
 *
 *  1. 命令式 API：`ElMessage`（21 个文件显式 import）、`ElMessageBox`（useImportHistory.js）。
 *     它们由 JS 直接调用 `Message(...)` 挂载到 body，不产生模板标签。
 *  2. 指令：`app.directive('loading', vLoading)`（main.js 注册，PlansPage /
 *     PlanSessionsPage / PlanOverviewPage / PlanDetailDrawer 使用 `v-loading`）。
 *  3. 显式 import 的组件：`el-table` / `el-table-column` / `el-tag` / `el-empty` /
 *     `el-alert` / `el-upload` / `el-icon` / `el-popconfirm` / `el-radio-*` 等。
 *     resolver 只在检测到**模板标签且当前文件没有同名 import** 时才注入，显式 import
 *     （例如 ImportHistoryTable.vue、ImportResultDialog.vue、DailySportChart.vue、
 *     SleepTimelineChart.vue）会绕过它，所以一并补齐。
 *
 * 这些 import 都指向 Element Plus 的 per-component 样式或 theme-chalk css，体积很小，
 * 且与 resolver 注入的样式是同一份文件（去重后不会重复计入产物）。
 *
 * 注意：这里 import 的是组件级 css，不是 `element-plus/dist/index.css`（全量 376 KB）。
 */
// base 提供全局 CSS 变量、reset 与动画（--el-color-*、--el-transition-* 等）。
// resolver 为每个组件注入的样式也依赖它，这里显式引入保证命令式 API 的变量可用。
import 'element-plus/es/components/base/style/css';

// ---- 命令式 API ----
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
// ---- 指令 ----
import 'element-plus/es/components/loading/style/css';
// ---- 显式 import 的组件 ----
import 'element-plus/es/components/alert/style/css';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/dialog/style/css';
import 'element-plus/es/components/empty/style/css';
import 'element-plus/es/components/icon/style/css';
import 'element-plus/es/components/popconfirm/style/css';
import 'element-plus/es/components/popover/style/css';
import 'element-plus/es/components/radio-button/style/css';
import 'element-plus/es/components/radio-group/style/css';
import 'element-plus/es/components/table/style/css';
import 'element-plus/es/components/table-column/style/css';
import 'element-plus/es/components/tag/style/css';
import 'element-plus/es/components/upload/style/css';

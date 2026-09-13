# 系统架构

## 目录结构

```text
heal-view/
├─ client/                  # Vue 3 前端
│  └─ src/
│     ├─ api/               # Axios 客户端和领域 API
│     ├─ components/        # 通用布局、图表、状态和业务组件
│     ├─ composables/       # 异步请求、看板数据和 ECharts 生命周期
│     ├─ domain/            # 健康规则与数据降级
│     ├─ pages/             # 路由页面及页面级 composable
│     ├─ stores/            # Pinia 服务端数据和持久化 UI 偏好
│     ├─ utils/             # 请求错误、数据解析等纯工具
│     └─ i18n/              # 中文、英文和 Element Plus 国际化
├─ server/                  # Express API 服务
│  └─ src/
│     ├─ controllers/       # 请求控制器
│     ├─ routes/             # API 路由
│     ├─ services/          # 数据库、导入和认证服务
│     └─ middleware/        # 请求中间件
├─ docs/                    # VitePress 文档
└─ tests/                   # 自动化测试
```

## 前端分层

```text
路由页面（pages）
  -> 页面 composable / dashboardContext
  -> Pinia store（服务端数据、日期选择、筛选、认证、主题和语言）
  -> api/fitnessApi + api/client
  -> Express API

图表与交互组件（components）只负责展示和事件派发；
数据转换、健康规则和请求错误归一化分别位于 domain/ 与 utils/。
```

路由页面使用懒加载，登录页和看板及导入、报告、计划、个人配置页面按路由拆分。共享的 `PageContainer`、`AsyncState`、`ChartPanel` 等组件统一页面外壳和 loading、empty、error 状态。

## 请求链路

```text
浏览器
  -> Vue 页面与 Pinia
  -> Axios /api 请求
  -> Vite 开发代理
  -> Express API
  -> service 层
  -> SQLite / 导入解析器
```

认证状态在路由守卫中使用 30 秒短缓存和并发请求复用；未通过访问保护时保存目标路由并回到登录页。API 客户端统一把 Axios 错误归一化为可翻译的错误状态，取消请求不会显示为用户错误。

日期侧栏请求先使用 30 秒缓存，再以最多 8 个日期为一批并行读取日汇总；强制刷新会取消过期请求。看板根据单日/多日模式和当前指标加载对应图表，过期响应不会覆盖较新的选择。

## 数据导入链路

导入页面上传归档压缩包后，后端使用导入服务解析文件，完成字段规范化和数据校验，再写入 SQLite。前端随后通过按日期和指标划分的 API 获取展示数据。

导入页面将上传、解析预览、确认入库和历史记录拆成独立组件与 composable；批量导入结果通过统一的状态组件呈现成功、部分异常和失败信息。

## 缓存与隐私

日期列表和日汇总等查询使用进程内缓存减少重复读取。访问保护采用单用户统一密码和会话 Cookie，适用于个人部署场景，不包含用户注册、多租户或第三方登录。

前端主题、语言、日期范围和视图模式保存在浏览器本地存储，仅作用于当前设备。ECharts 通过按需注册和懒加载降低首屏成本；共享 `useEchartsInstance` 负责初始化、窗口尺寸响应、主题色更新和卸载销毁。

## 可访问性与质量边界

- 导航、日期项、指标卡和视图切换支持键盘操作，并提供基础 ARIA 语义和焦点状态。
- 关键多日图表提供可展开的数据摘要表；小屏图表区域支持横向浏览。
- 提交前由 Husky + lint-staged 只格式化暂存文件；ESLint 扫描 `client/src`，GitHub Actions 继续执行格式、静态检查、i18n、测试和构建。
- 页面级浏览器测试、截图基线和更广泛的边界测试暂未纳入当前架构约束，待需求和验收标准明确后补充。

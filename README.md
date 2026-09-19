# 运动健康数据可视化仪表板

这是一个用于展示和分析运动健康数据的 Web 仪表板。项目会支持小米运动健康、华为运动健康等运动面板的数据导入与可视化，通过直观的图表和界面，帮助您更好地了解自己的运动和健康状况。

## 功能特点

- 📊 **数据可视化**：使用 ECharts 展示步数、卡路里、心率、睡眠、血压等关键指标
- 📥 **多平台导入**：支持小米运动健康、华为运动健康等运动面板数据
- 📅 **日期浏览**：左侧日期列表，快速查看历史数据
- 🔍 **智能筛选**：支持按日期范围、运动类型等条件筛选
- 😴 **睡眠分析**：睡眠阶段时间线（深睡/浅睡/REM/清醒），支持午睡与夜间睡眠区分
- 📱 **响应式设计**：适配不同屏幕尺寸
- ⚡ **高性能**：SQLite数据库 + 内存缓存，快速查询响应
- 🔐 **隐私保护**：可在个人配置中开启单密码访问保护

## 技术栈

### 后端
- Node.js + Express
- SQLite（`node:sqlite`，Node.js 内置模块，零原生依赖，无需编译）
- 缓存：node-cache（进程内内存缓存，单用户单机场景无需 Redis）
- 运动健康归档解析
- CSV 解析

### 前端
- Vue 3 + Vite
- Pinia（状态管理）
- ECharts（图表库）
- Axios（HTTP客户端）

### 工程化
- pnpm workspace：client / server 统一管理，单一锁文件（`pnpm-lock.yaml`）
- 内置单元测试：`node:test` 覆盖核心规则计算与数据解析

## 快速开始

### 前置要求

- Node.js >= 22.13.0（使用内置的 `node:sqlite` 模块）
- pnpm >= 9（`corepack enable pnpm` 或 `npm i -g pnpm` 安装）
- 推荐同时准备一个支持 SQLite 文件持久化的本地或 NAS 存储目录

### 环境变量

后端默认只依赖以下变量，详见 [server/.env.example](server/.env.example)：

- `PORT`：后端端口，默认 `43128`
- `CACHE_TTL_DATES`：日期列表缓存秒数，默认 `86400`
- `CACHE_TTL_SUMMARY`：日汇总缓存秒数，默认 `3600`
- `AUTH_SESSION_TTL`：访问保护会话有效期秒数，默认 `604800`（7天）
- `AUTH_COOKIE_NAME`：访问保护 Cookie 名称，默认 `heal_view_session`
- `AUTH_COOKIE_SECURE`：是否给登录 Cookie 加 `Secure`，生产 HTTPS 默认 `true`；若临时直接使用 HTTP 端口需设为 `false`
- `DATA_DIR`：CSV/原始数据目录，Docker 中默认 `/app/data`
- `DB_PATH`：SQLite 文件路径，Docker 中默认 `/app/data/health_data.db`
- `UPLOAD_DIR`：上传压缩包临时目录，Docker 中默认 `/app/uploads`

### 安装依赖

在仓库根目录执行一次安装，即可安装前后端所有依赖：

```bash
pnpm install
```

### 启动后端

```bash
pnpm --filter heal-view-server start
```

后端服务器将运行在 http://localhost:43128

首次使用（或更新数据时）需要先导入运动健康数据，直接在页面上传压缩包即可：

```bash
pnpm --filter heal-view-server import
```

### 启动前端（开发模式）

```bash
pnpm --filter heal-view-client dev
```

前端应用将运行在 http://localhost:43127

> 根目录 `package.json` 提供了快捷脚本：`pnpm dev:client`、`pnpm dev:server`、`pnpm start:server`、`pnpm build:client`、`pnpm import`。

### 访问保护

应用默认关闭访问保护。进入“个人配置”后，可以开启“访问保护”并设置一个统一密码。

开启后，查看看板、导入数据和个人配置都需要先输入密码。该功能是单用户个人版的隐私拦截，不包含用户名、注册、多用户和第三方登录。

如果忘记密码，请在运行项目的服务器控制台执行：

```bash
pnpm reset-access-password
```

按照提示重新设置密码。直接回车可以关闭访问保护。

### 访问应用

在浏览器中打开 http://localhost:43127 即可使用应用。

### 运行测试

在仓库根目录执行：

```bash
pnpm test
```

只跑前端或后端测试：

```bash
pnpm test:client
pnpm test:server
```

API 冒烟测试默认检查本地服务健康状态；设置 `SMOKE_PASSWORD` 后会继续验证访问保护、登录、日期列表和日汇总流程：

```bash
SMOKE_PASSWORD=你的访问密码 pnpm test:smoke
```

Windows PowerShell：

```powershell
$env:SMOKE_PASSWORD = '你的访问密码'
pnpm test:smoke
```

## Docker 部署（单容器方案）

镜像会自动安装依赖、构建 Vue 前端，并由同一个 Express 进程提供前端和 `/api`。SQLite 数据库、导入文件分别挂载到 `deploy/data` 和 `deploy/uploads`，容器重建不会丢数据。

```bash
# 在服务器上首次部署
git clone https://github.com/CrazyStudent13/heal-view.git
cd heal-view
cp deploy/.env.example deploy/.env
mkdir -p deploy/data deploy/uploads
# 官方 Node 镜像中的 node 用户 UID 是 1000，确保绑定目录可写
sudo chown -R 1000:1000 deploy/data deploy/uploads

# 本地构建并启动；生产环境建议放在 Nginx/Caddy HTTPS 反向代理后面
docker compose --env-file deploy/.env up -d --build
docker compose --env-file deploy/.env ps
curl http://127.0.0.1:43128/health
```

更新时执行：

```bash
git pull
docker compose --env-file deploy/.env up -d --build
```

备份只需停止写入后复制 `deploy/data/health_data.db`（以及需要保留的 `deploy/uploads`）。不要把 SQLite 文件直接映射到容器内的 `/app/server`，应使用 Compose 中的 `/app/data` 持久卷。

### GitHub Actions 自动发布

`.github/workflows/deploy.yml` 会在 `main` 分支 push 时构建镜像并推送到 GHCR，然后通过 SSH 执行 `docker compose pull && docker compose up -d`。服务器首次准备：

1. 安装 Docker Engine 和 Compose 插件，克隆仓库，复制 `deploy/.env.example` 为 `deploy/.env`，创建 `deploy/data` 与 `deploy/uploads`。
2. 在仓库 Settings → Secrets and variables → Actions 添加 `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`DEPLOY_PATH`（例如 `/opt/heal-view`）和具有 `read:packages` 权限的 `GHCR_TOKEN`。
3. 将 GHCR 镜像设为可见，或确保服务器用该 Token 登录 GHCR。工作流会自动把 `HEAL_VIEW_IMAGE` 更新为本次发布的镜像。

如果不需要 SSH 自动更新，只保留镜像构建步骤即可；服务器上手动执行 `docker compose --env-file deploy/.env pull && docker compose --env-file deploy/.env up -d`。

## 项目结构

```
heal-view/
├── server/                    # 后端服务
│   ├── src/
│   │   ├── config/            # 配置文件
│   │   ├── controllers/       # API控制器
│   │   ├── services/          # 业务逻辑服务（database.js 基于 node:sqlite）
│   │   ├── routes/            # API路由
│   │   ├── utils/             # 工具函数
│   │   └── scripts/           # 数据导入脚本
│   └── cache/                 # 内存缓存（node-cache，运行时生成）
├── deploy/                    # Docker 生产环境配置与持久化目录
│   ├── .env.example
│   ├── data/                  # SQLite 数据库和 CSV 数据
│   └── uploads/               # 导入压缩包临时目录
│
├── client/                    # 前端应用
│   ├── src/
│   │   ├── api/               # API客户端
│   │   ├── domain/            # 领域规则与数据兜底
│   │   ├── components/        # Vue组件
│   │   │   ├── layout/        # 布局组件
│   │   │   ├── filters/       # 筛选组件
│   │   │   └── charts/        # 图表组件
│   │   ├── utils/             # 前端通用工具
│   │   ├── stores/            # Pinia状态管理
│   │   ├── composables/       # 组合式函数
│   │   └── App.vue            # 根组件
│   ├── public/                # 静态资源
│   ├── dist/                  # 构建产物（vite build 生成）
│   └── vite.config.js         # Vite配置
│
├── tests/                     # node:test 单元测试
│   ├── client/                # 前端纯函数与兜底逻辑测试
│   └── server/                # 后端 JSON 解析测试
│
├── pnpm-workspace.yaml        # pnpm workspace 配置（client + server）
├── pnpm-lock.yaml             # 单一依赖锁文件
└── README.md
```

## API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/dates` | GET | 获取所有有数据的日期列表 |
| `/api/dates/:date/summary` | GET | 获取指定日期的汇总数据 |
| `/api/dates/:date/:metric` | GET | 获取指定指标的时序数据（steps/calories/heart_rate/stress） |
| `/api/sports` | GET | 获取运动记录（支持 startDate/endDate/category 筛选） |
| `/api/filters/options` | GET | 获取筛选项（运动类型等） |
| `/api/sleep/timeline/:date` | GET | 获取指定日期的睡眠阶段时间线 |
| `/api/weight/data` | GET | 获取体重数据（支持 startDate/endDate 筛选） |
| `/api/user/profile` | GET | 获取用户档案（身高、BMI、BMR等） |
| `/api/auth/status` | GET | 获取访问保护状态 |
| `/api/auth/login` | POST | 使用统一密码登录 |
| `/api/auth/logout` | POST | 退出访问保护会话 |
| `/api/auth/settings` | GET/PUT | 读取或修改访问保护配置 |

## 数据说明

本应用面向运动健康数据面板，当前重点支持小米运动健康，并会支持华为运动健康等数据来源。当前导入流程以页面上传归档为主，支持识别以下小米运动健康导出的数据文件：

- `hlth_center_fitness_data.csv` - 健康数据中心健身数据
- `hlth_center_sport_record.csv` - 运动记录数据
- `hlth_center_aggregated_fitness_data.csv` - 聚合健康数据
- `user_member_profile.csv` / `user_fitness_profile.csv` - 用户档案（身高、体重目标等）

主要展示的指标包括：
- 步数（steps）
- 卡路里消耗（calories）
- 心率（heart_rate）
- 血压（blood_pressure）
- 压力指数（stress）
- 睡眠（sleep，含阶段分析）
- 体重（weight）
- 运动记录（sport records）

## 常见问题

### Q: 数据导入很慢怎么办？
A: 首次导入较大的运动健康归档或 CSV 文件可能需要几分钟时间。导入过程已使用事务包裹（整体一次提交），请耐心等待，导入完成后后续查询会非常快。

### Q: 如何更新数据？
A: 可以在页面中重新导入运动健康归档，然后重新运行导入流程。

### Q: 为什么要求 Node.js >= 22.13？
A: 本项目使用 Node.js 内置的 `node:sqlite` 模块替代了之前的 sql.js（WASM 内存数据库）。`node:sqlite` 零原生依赖、直接读写磁盘文件，内存占用更低、写入更省闪存，更适合 NAS 长期运行。

### Q: 需要 Redis 吗？
A: 不需要。单用户单机场景下，缓存由 `server/src/services/cacheManager.js` 的 node-cache 进程内内存缓存承担（TTL 自动过期、服务重启后自然失效重建），完全够用。Redis 是为多用户、多实例场景准备的分布式缓存方案，未来若做多用户版再引入不迟。

### Q: 可以在手机上访问吗？
A: 可以。在前端运行时添加 `--host` 参数：`pnpm --filter heal-view-client dev -- --host`，然后在同一局域网的设备上访问显示的IP地址。

## 性能优化建议

1. **大数据量处理**：目前只导入有价值的指标（步数、卡路里、心率等），过滤掉高频低价值的数据
2. **缓存策略**：使用 node-cache 进程内内存缓存，日期列表缓存24小时、日度汇总缓存1小时；单机单用户场景无需 Redis，服务重启后缓存自然失效重建
3. **按需加载**：图表组件只在需要时渲染

## 开发计划

- [x] 睡眠质量分析（睡眠阶段时间线）
- [x] 添加数据对比功能（多日对比）
- [x] 暗黑模式支持

## 许可证

本项目仅供个人学习和使用。

## 致谢

感谢小米运动健康、华为运动健康等平台提供数据导出能力，以及所有开源项目的贡献者。

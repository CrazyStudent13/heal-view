# 小米运动健康数据可视化仪表板

这是一个用于展示和分析小米运动健康（MiFitness）导出数据的Web应用。通过直观的图表和界面，帮助您更好地了解自己的运动和健康状况。

## 功能特点

- 📊 **数据可视化**：使用ECharts展示步数、卡路里、心率等关键指标
- 📅 **日期浏览**：左侧日期列表，快速查看历史数据
- 🔍 **智能筛选**：支持按日期范围、运动类型等条件筛选
- 😴 **睡眠分析**：睡眠阶段时间线（深睡/浅睡/REM/清醒），支持午睡与夜间睡眠区分
- 📱 **响应式设计**：适配不同屏幕尺寸
- ⚡ **高性能**：SQLite数据库 + 内存缓存，快速查询响应

## 技术栈

### 后端
- Node.js + Express
- SQLite（`node:sqlite`，Node.js 内置模块，零原生依赖，无需编译）
- CSV解析

### 前端
- Vue 3 + Vite
- Pinia（状态管理）
- ECharts（图表库）
- Axios（HTTP客户端）

### 工程化
- pnpm workspace：client / server 统一管理，单一锁文件（`pnpm-lock.yaml`）

## 快速开始

### 前置要求

- Node.js >= 22.13.0（使用内置的 `node:sqlite` 模块）
- pnpm >= 9（`corepack enable pnpm` 或 `npm i -g pnpm` 安装）

### 安装依赖

在仓库根目录执行一次安装，即可安装前后端所有依赖：

```bash
pnpm install
```

### 启动后端

```bash
pnpm --filter heal-view-server start
```

后端服务器将运行在 http://localhost:3000

首次使用（或更新数据时）需要先导入CSV数据（CSV文件放在仓库根目录 `data/` 下）：

```bash
pnpm --filter heal-view-server import
```

### 启动前端（开发模式）

```bash
pnpm --filter heal-view-client dev
```

前端应用将运行在 http://localhost:5173

> 根目录 `package.json` 提供了快捷脚本：`pnpm dev:client`、`pnpm dev:server`、`pnpm start:server`、`pnpm build:client`、`pnpm import`。

### 访问应用

在浏览器中打开 http://localhost:5173 即可使用应用。

## NAS 部署（单容器方案）

适用于群晖/QNAP 等 NAS 上的 Docker / Container Manager：

```bash
# 1. 构建前端产物（仓库根目录执行）
pnpm --filter heal-view-client build   # 产物输出到 client/dist

# 2. 构建镜像（从仓库根目录执行）
docker build -t heal-view .

# 3. 运行（将 SQLite 文件放到持久卷，备份 = 拷贝一个文件）
docker run -d \
  -p 3000:3000 \
  -v /path/to/data:/app/data \
  -v /path/to/health_data.db:/app/server/health_data.db \
  --name heal-view \
  heal-view
```

构建后的前端静态文件由 Express 统一托管，单容器、单端口、单进程，管理最省事。`node:sqlite` 是 Node 内置模块，在 NAS 的 ARM 芯片上也无需编译，开箱即用。

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
│   ├── cache/                 # 内存缓存（node-cache，运行时生成）
│   └── health_data.db         # SQLite数据库文件
│
├── client/                    # 前端应用
│   ├── src/
│   │   ├── api/               # API客户端
│   │   ├── components/        # Vue组件
│   │   │   ├── layout/        # 布局组件
│   │   │   ├── filters/       # 筛选组件
│   │   │   └── charts/        # 图表组件
│   │   ├── stores/            # Pinia状态管理
│   │   ├── composables/       # 组合式函数
│   │   └── App.vue            # 根组件
│   ├── public/                # 静态资源
│   ├── dist/                  # 构建产物（vite build 生成）
│   └── vite.config.js         # Vite配置
│
├── data/                      # CSV源文件目录（仓库根目录）
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

## 数据说明

本应用支持以下小米运动健康导出的数据文件（放在仓库根目录 `data/` 下）：

- `hlth_center_fitness_data.csv` - 健康数据中心健身数据
- `hlth_center_sport_record.csv` - 运动记录数据
- `hlth_center_aggregated_fitness_data.csv` - 聚合健康数据
- `user_member_profile.csv` / `user_fitness_profile.csv` - 用户档案（身高、体重目标等）

主要展示的指标包括：
- 步数（steps）
- 卡路里消耗（calories）
- 心率（heart_rate）
- 压力指数（stress）
- 睡眠（sleep，含阶段分析）
- 体重（weight）
- 运动记录（sport records）

## 常见问题

### Q: 数据导入很慢怎么办？
A: 首次导入129MB的CSV文件可能需要几分钟时间。导入过程已使用事务包裹（整体一次提交），请耐心等待，导入完成后后续查询会非常快。

### Q: 如何更新数据？
A: 将新的CSV文件放入仓库根目录 `data/`，然后重新运行 `npm run import`。

### Q: 为什么要求 Node.js >= 22.13？
A: 本项目使用 Node.js 内置的 `node:sqlite` 模块替代了之前的 sql.js（WASM 内存数据库）。`node:sqlite` 零原生依赖、直接读写磁盘文件，内存占用更低、写入更省闪存，更适合 NAS 长期运行。

### Q: 可以在手机上访问吗？
A: 可以。在前端运行时添加 `--host` 参数：`npm run dev -- --host`，然后在同一局域网的设备上访问显示的IP地址。

## 性能优化建议

1. **大数据量处理**：目前只导入有价值的指标（步数、卡路里、心率等），过滤掉高频低价值的数据
2. **缓存策略**：日期列表缓存24小时，日度汇总缓存1小时
3. **按需加载**：图表组件只在需要时渲染

## 开发计划

- [x] 睡眠质量分析（睡眠阶段时间线）
- [ ] 压力趋势分析
- [ ] 支持数据导出功能
- [ ] 添加数据对比功能（多日对比）
- [ ] 移动端优化
- [ ] 暗黑模式支持

## 许可证

本项目仅供个人学习和使用。

## 致谢

感谢小米运动健康提供数据导出功能，以及所有开源项目的贡献者。

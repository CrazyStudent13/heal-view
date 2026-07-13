# 小米运动健康数据可视化仪表板

这是一个用于展示和分析小米运动健康（MiFitness）导出数据的Web应用。通过直观的图表和界面，帮助您更好地了解自己的运动和健康状况。

## 功能特点

- 📊 **数据可视化**：使用ECharts展示步数、卡路里、心率等关键指标
- 📅 **日期浏览**：左侧日期列表，快速查看历史数据
- 🔍 **智能筛选**：支持按日期范围、运动类型等条件筛选
- 📱 **响应式设计**：适配不同屏幕尺寸
- ⚡ **高性能**：SQLite数据库缓存，快速查询响应

## 技术栈

### 后端
- Node.js + Express
- SQLite (sql.js)
- CSV解析

### 前端
- Vue 3 + Vite
- Pinia（状态管理）
- ECharts（图表库）
- Axios（HTTP客户端）

## 快速开始

### 前置要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装步骤

#### 1. 后端设置

```bash
# 进入后端目录
cd server

# 安装依赖
npm install

# 导入CSV数据到SQLite（首次运行需要）
npm run import

# 启动后端服务器
npm start
```

后端服务器将运行在 http://localhost:3000

#### 2. 前端设置

打开新的终端窗口：

```bash
# 进入前端目录
cd client

# 安装依赖（如果还未安装）
npm install

# 启动开发服务器
npm run dev
```

前端应用将运行在 http://localhost:5173

### 访问应用

在浏览器中打开 http://localhost:5173 即可使用应用。

## 项目结构

```
heal-view/
├── server/                    # 后端服务
│   ├── src/
│   │   ├── config/            # 配置文件
│   │   ├── controllers/       # API控制器
│   │   ├── services/          # 业务逻辑服务
│   │   ├── routes/            # API路由
│   │   ├── utils/             # 工具函数
│   │   └── scripts/           # 数据导入脚本
│   ├── data/                  # CSV源文件目录
│   └── health_data.db         # SQLite数据库文件
│
├── client/                  # 前端应用
│   ├── src/
│   │   ├── api/              # API客户端
│   │   ├── components/       # Vue组件
│   │   │   ├── layout/       # 布局组件
│   │   │   ├── filters/      # 筛选组件
│   │   │   └── charts/       # 图表组件
│   │   ├── stores/           # Pinia状态管理
│   │   ├── composables/      # 组合式函数
│   │   └── App.vue           # 根组件
│   └── vite.config.js        # Vite配置
│
└── README.md
```

## API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/dates` | GET | 获取所有有数据的日期列表 |
| `/api/dates/:date/summary` | GET | 获取指定日期的汇总数据 |
| `/api/dates/:date/:metric` | GET | 获取指定指标的时序数据 |
| `/api/sports` | GET | 获取运动记录（支持筛选） |
| `/api/filters/options` | GET | 获取筛选项（运动类型等） |

## 数据说明

本应用支持以下小米运动健康导出的数据文件：

- `hlth_center_fitness_data.csv` - 健康数据中心健身数据
- `hlth_center_sport_record.csv` - 运动记录数据
- `hlth_center_aggregated_fitness_data.csv` - 聚合健康数据

主要展示的指标包括：
- 步数（steps）
- 卡路里消耗（calories）
- 心率（heart_rate）
- 压力指数（stress）
- 运动记录（sport records）

## 常见问题

### Q: 数据导入很慢怎么办？
A: 首次导入129MB的CSV文件可能需要几分钟时间。请耐心等待，导入完成后后续查询会非常快。

### Q: 如何更新数据？
A: 将新的CSV文件放入 `server/data` 目录，然后重新运行 `npm run import`。

### Q: 可以在手机上访问吗？
A: 可以。在前端运行时添加 `--host` 参数：`npm run dev -- --host`，然后在同一局域网的设备上访问显示的IP地址。

## 性能优化建议

1. **大数据量处理**：目前只导入有价值的指标（步数、卡路里、心率等），过滤掉高频低价值的数据
2. **缓存策略**：日期列表缓存24小时，日度汇总缓存1小时
3. **按需加载**：图表组件只在需要时渲染

## 开发计划

- [ ] 添加更多图表类型（睡眠质量分析、压力趋势等）
- [ ] 支持数据导出功能
- [ ] 添加数据对比功能（多日对比）
- [ ] 移动端优化
- [ ] 暗黑模式支持

## 许可证

本项目仅供个人学习和使用。

## 致谢

感谢小米运动健康提供数据导出功能，以及所有开源项目的贡献者。

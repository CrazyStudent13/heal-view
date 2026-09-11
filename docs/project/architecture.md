# 系统架构

## 目录结构

```text
heal-view/
├─ client/                  # Vue 3 前端
│  └─ src/
│     ├─ components/        # 通用布局、图表和业务组件
│     ├─ pages/             # 路由页面
│     ├─ stores/            # Pinia 状态
│     └─ i18n/              # 国际化
├─ server/                  # Express API 服务
│  └─ src/
│     ├─ controllers/       # 请求控制器
│     ├─ routes/             # API 路由
│     ├─ services/          # 数据库、导入和认证服务
│     └─ middleware/        # 请求中间件
├─ docs/                    # VitePress 文档
└─ tests/                   # 自动化测试
```

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

## 数据导入链路

导入页面上传归档压缩包后，后端使用导入服务解析文件，完成字段规范化和数据校验，再写入 SQLite。前端随后通过按日期和指标划分的 API 获取展示数据。

## 缓存与隐私

日期列表和日汇总等查询使用进程内缓存减少重复读取。访问保护采用单用户统一密码和会话 Cookie，适用于个人部署场景，不包含用户注册、多租户或第三方登录。

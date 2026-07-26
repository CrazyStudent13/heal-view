# Heal View Nest 后端

这是 MySQL 后端重构的阶段性 NestJS 骨架。目前已完成：

- NestJS 11 项目初始化；
- MySQL / TypeORM 连接配置；
- 环境变量校验；
- 全局 `/api` 前缀、参数校验、CORS 和基础安全响应头；
- `GET /api/health` 数据库健康检查；
- MySQL 初始化脚本执行入口。

用户认证、健康数据导入和 Redis 会话管理尚未实现，后续开发请参照
[`../docs/nest-mysql-redis-refactor-plan.md`](../docs/nest-mysql-redis-refactor-plan.md)。

## 本地配置

复制 `.env.example` 为 `.env`，只在本机填写真实连接信息。`.env` 及其他环境配置文件不会提交到 Git。

```dotenv
PORT=3000
WEB_ORIGIN=http://localhost:5173

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USERNAME=heal_view_app
MYSQL_PASSWORD=请填写本地密码
MYSQL_DATABASE=heal_view
MYSQL_SSL_ENABLED=false

JWT_ACCESS_SECRET=请填写至少32字节的随机密钥
JWT_ACCESS_TTL_SECONDS=900
SESSION_TTL_DAYS=30
```

生产环境不要使用 MySQL `root` 账号。应创建仅拥有 `heal_view` 所需权限的应用账号，并通过部署平台注入密码和 JWT 密钥。

## 安装与检查

```bash
npm install
npm run build
npm test
```

## 初始化数据库

初始化脚本会读取仓库中的 `server/mysql-init.sql`。确认环境变量指向目标 MySQL 实例后执行：

```bash
npm run db:init
```

## 启动

```bash
npm run start:dev
```

启动成功后，健康检查地址为 `http://localhost:3000/api/health`。

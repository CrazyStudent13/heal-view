# 快速开始

## 环境要求

- Node.js `>= 22.13.0`
- pnpm `>= 9.15.0`
- 支持 SQLite 文件持久化的本地目录或 NAS 存储

## 安装依赖

在项目根目录执行：

```bash
pnpm install
```

## 启动应用

分别打开两个终端：

```bash
pnpm dev:server
```

后端默认运行在 `http://localhost:3000`。

```bash
pnpm dev:client
```

前端默认运行在 `http://localhost:5173`。浏览器访问前端地址即可使用应用。

## 启动文档站

```bash
pnpm docs:dev
```

文档站默认运行在 `http://localhost:5174`。也可以使用以下命令验证生产构建：

```bash
pnpm docs:build
pnpm docs:preview
```

## 常用检查

```bash
pnpm test
pnpm test:client
pnpm test:server
pnpm build:client
```

## 环境变量

后端可通过 `server/.env` 配置端口、缓存时间、会话有效期和 Cookie 名称，具体变量见 `server/.env.example`。

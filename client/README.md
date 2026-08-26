# heal-view 前端

基于 Vue 3 + Vite + Element Plus + ECharts 的健康数据可视化界面。

## 开发

```bash
# 开发模式（仓库根目录执行）
pnpm --filter heal-view-client dev

# 生产构建（产物输出到 dist/）
pnpm --filter heal-view-client build
```

## 说明

- 开发时通过 Vite 代理将 `/api` 转发到本地后端（默认 `http://localhost:3000`），见 `vite.config.js`
- 生产部署时将 `dist/` 交由后端 Express 静态托管，单容器部署

详见仓库根目录 [README.md](../README.md)。

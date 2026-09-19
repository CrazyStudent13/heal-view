FROM node:22.13-bookworm-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy manifests first so dependency installation is cached between source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile

COPY client client
COPY server server
RUN pnpm --filter heal-view-client build

FROM node:22.13-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=43128 \
    DATA_DIR=/app/data \
    DB_PATH=/app/data/health_data.db \
    UPLOAD_DIR=/app/uploads

COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/server /app/server
COPY --from=build /app/client/dist /app/client/dist

RUN mkdir -p /app/data /app/uploads \
    && chown -R node:node /app
USER node

VOLUME ["/app/data", "/app/uploads"]
EXPOSE 43128
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:43128/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/src/app.js"]

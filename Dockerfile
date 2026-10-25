# ClipNote 单容器镜像：多阶段构建 web（Vite 静态产物）+ server（tsc），运行时 Node 自持
# 静态托管 + API + WS。构建上下文为仓库根目录，直接引用 server/ 与 web/ 子目录。
#
# better-sqlite3 v13+ 的 N-API 预编译二进制随包分发、运行时加载，无需编译；
# --ignore-scripts 规避 npm≤10 对含 binding.gyp 的包自动执行 node-gyp 的行为
# （server 全部依赖均为纯 JS/预编译包，无任何 install 脚本）
ARG NODE_IMAGE=node:22-alpine3.22

FROM ${NODE_IMAGE} AS web-build
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm config set registry "$NPM_REGISTRY" && npm ci
COPY web/tsconfig.json web/vite.config.js web/vite.config.ts web/index.html ./
COPY web/src ./src
COPY web/public ./public
RUN npm run build

FROM ${NODE_IMAGE} AS server-build
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm config set registry "$NPM_REGISTRY" && npm ci --ignore-scripts
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PUBLIC_DIR=/app/public
WORKDIR /app
COPY --from=server-build /app/node_modules ./node_modules
COPY --from=server-build /app/dist ./dist
COPY --from=web-build /app/dist ./public
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/index.js"]

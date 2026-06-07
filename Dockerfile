# =========================================================
# Stage 1: Build the frontend (Vite)
# =========================================================
FROM node:20-alpine AS frontend-build

WORKDIR /build

# 依赖与构建分离：先复制 lockfile 装依赖，缓存友好
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
 && npm ci --no-audit --no-fund

# 再复制源码（避免本地 node_modules 覆盖刚装好的）
COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js eslint.config.js index.html ./
COPY public ./public
COPY src ./src

# 构建时可通过 --build-arg VITE_API_URL=/api 覆盖
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build
# 产物在 /build/dist


# =========================================================
# Stage 2: Build the backend (tsc → dist/)
# =========================================================
FROM node:20-alpine AS backend-build

WORKDIR /build

# sqlite3 需要原生编译，准备工具链
RUN apk add --no-cache python3 make gcc g++

COPY backend/package.json backend/package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
 && npm ci --no-audit --no-fund

COPY backend/tsconfig.json ./
COPY backend/src ./src

RUN npm run build
# 产物在 /build/dist


# =========================================================
# Stage 3: Runtime image
# =========================================================
FROM node:20-alpine

WORKDIR /app

# 时区 + 创建持久化目录
RUN apk add --no-cache tzdata \
 && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
 && echo "Asia/Shanghai" > /etc/timezone \
 && mkdir -p /app/data /app/uploads /app/public

# 复制后端产物与依赖
COPY --from=backend-build /build/dist          /app/dist
COPY --from=backend-build /build/node_modules  /app/node_modules

# 复制前端静态资源
COPY --from=frontend-build /build/dist         /app/public

# 暴露端口
EXPOSE 3001

# 运行配置
ENV NODE_ENV=production \
    PORT=3001 \
    UPLOAD_DIR=/app/uploads \
    DATABASE_PATH=/app/data/photo-album.sqlite

# 持久化数据卷
VOLUME ["/app/data", "/app/uploads"]

# 健康检查：直接用 node 发请求，避免再装 curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+process.env.PORT+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]

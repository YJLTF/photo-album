# 个人相册应用

一款面向个人用户的媒体管理工具，支持图片与视频上传、预览、相册分类、标签管理与自定义轮播播放。数据存放在服务器端，通过访问密码进行权限控制。

## 功能特性

### 🔐 认证与权限
- 基于访问密码的认证（JWT）
- 三级权限：查看者（VIEWER）、编辑者（EDITOR）、管理员（ADMIN）
- 首次启动自动生成默认管理员密钥 `admin123`

### 📁 相册管理
- 创建、删除、重命名相册
- 卡片视图展示（封面图、名称、图片数量）
- 自定义封面上传
- **自动封面**：新建相册后上传的第一张图片会被自动设为封面

### 🖼️ 图片与视频管理
- 拖拽或点击上传（支持批量，真实上传进度）
- 支持视频上传（MP4 / WebM / MOV / MKV / AVI，≤ 500MB），上传时浏览器自动截取封面帧
- 网格展示（服务端 WebP 缩略图，按需生成并缓存；视频卡片带播放角标）
- 全屏预览（图片缩放/旋转，视频原生播放器、支持拖动进度条）
- 单张 / 批量删除（删除封面图时自动顺延到剩余的第一张）
- 相册内容较多时分页加载（每页 50 个，"加载更多"追加）

### 🗑️ 回收站
- 删除的相册与图片为软删除，可在回收站中恢复
- **30 天自动清理**：软删除超过 30 天的条目由后端定时任务彻底删除（`RECYCLE_RETENTION_DAYS` 可调，设为 0 关闭）
- 彻底删除 / 清空回收站时才清理物理文件与轮播引用
- 相册恢复时其中的图片一并恢复

### 🏷️ 标签管理
- 为图片添加 / 移除标签
- 多标签组合筛选
- 每个标签可拥有自己的颜色（创建时自动从调色板分配）
- 标签页内可视化管理、创建、删除

### 🎬 轮播功能
- 从相册中选择轮播图片（仅图片；视频不参与轮播）
- 多种切换效果（淡入淡出 / 滑动 / 缩放 / 翻转 / 模糊）
- 为每张图片添加自定义文字与位置
- 设置切换间隔与自动播放
- 全屏沉浸式播放
- 保存和加载轮播方案

## 技术栈

### 前端
- **框架**：React 18 + TypeScript
- **构建**：Vite 6
- **样式**：Tailwind CSS 3
- **路由**：React Router DOM 7
- **图标**：Lucide React

### 后端
- **框架**：Express 4 + TypeScript
- **数据库**：SQLite + TypeORM
- **认证**：JWT（jsonwebtoken；访问密钥加密存储，见「安全说明」）
- **文件上传**：Multer 2（图片 ≤ 20MB，视频 ≤ 500MB；视频封面帧由浏览器截取，服务端无 ffmpeg 依赖）

## 快速开始

### 环境要求
- Node.js 18+
- npm 9+

### 1. 启动后端

```bash
cd backend
npm install
npm run build
npm start
```

默认运行在 `http://localhost:3001`（可通过 `backend/.env` 中的 `PORT` 覆盖）。
后端需要在 `backend/.env` 中设置 `JWT_SECRET`，未设置时启动会直接失败。

> 首次启动会自动在 `data/photo-album.sqlite` 创建数据库，并插入默认管理员密钥 `admin123`。**生产环境请立即修改或删除。**

### 2. 启动前端

```bash
npm install
npm run dev
```

默认运行在 `http://localhost:5173`。若后端端口非 3001，通过根目录 `.env` 中的 `VITE_API_URL` 覆盖，例如后端跑在 3002 时：

```
VITE_API_URL=http://localhost:3002/api
```

### 3. 登录

在登录页输入访问密钥：
- 管理员：`admin123`（首次启动默认）
- 也可通过管理员在「访问密钥」页面创建其他密钥

## 脚本命令

### 前端

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 类型检查 + 生产构建（产物在 `dist/`） |
| `npm run check` | 仅做 TypeScript 类型检查 |
| `npm run lint` | 运行 ESLint |
| `npm test` | 运行单元测试（vitest） |
| `npm run preview` | 预览生产构建产物 |

### 后端

| 命令 | 说明 |
|------|------|
| `npm run dev` | ts-node 直跑源码（开发用） |
| `npm run build` | 编译到 `dist/` |
| `npm start` | 跑编译产物（生产用） |

## Docker 部署

### 一键启动

1. 复制环境变量模板并填入强随机 JWT 密钥：

   ```bash
   cp .env.example .env
   # 用 `openssl rand -hex 32` 生成一个填到 .env 的 JWT_SECRET
   ```

2. 构建并启动：

   ```bash
   docker-compose up -d
   docker-compose logs -f
   ```

3. 浏览器访问 `http://localhost`（默认端口 80，即 `.env` 中的 `PORT`），使用首次启动自动生成的密钥 `admin123` 登录（**登录后请立即在「访问密钥」页面修改或新增**）。

### 常用命令

```bash
docker build -t photo-album:latest . # 构建镜像
docker save photo-album:latest -o ./photo-album.tar # 导出镜像
docker-compose up -d      # 启动（后台）
docker-compose logs -f    # 查看日志
docker-compose stop       # 停止（保留数据卷）
docker-compose down       # 停止并移除容器
docker-compose down -v    # 同时清除数据卷（会丢数据！）
docker-compose up -d --build  # 重新构建镜像后启动
```

### 一键部署到正式环境

本地构建镜像 → 导出 tar.gz → scp 上传 → 服务器 `docker load` → `docker compose` 重建容器 → 健康检查通过后自动清理旧镜像与临时文件，一条命令完成：

```bash
./deploy.sh
```

首次使用前配置一次 SSH 免密：

```bash
cp .deploy.env.example .deploy.env   # 填入服务器 SSH 密码（已被 .gitignore 忽略）
./deploy.sh init                     # 自动安装公钥；成功后 .deploy.env 可删除
```

其他子命令：

```bash
./deploy.sh status   # 查看服务器容器 / 镜像 / 磁盘状态
./deploy.sh logs     # 跟随查看服务器日志（Ctrl+C 退出）
./deploy.sh build    # 仅本地构建镜像
./deploy.sh backup   # 备份服务器 data/ 与 uploads/ 到本地 backups/
```

说明：

- 目标服务器、路径等参数在 `deploy.sh` 顶部，可用环境变量 `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_DIR` / `DEPLOY_IMAGE` 覆盖。
- 服务器上的 `.env`（含 `JWT_SECRET`）由服务器自行维护，部署脚本不会覆盖；`docker-compose.yml` 每次部署同步为仓库版本。
- 前端构建的 `VITE_API_URL` 取自**服务器** env 配置，避免把本地开发地址（localhost）打进生产镜像。
- 健康检查未通过时不删除旧镜像，可按脚本输出的命令手动回滚。
- `backup` 默认先停容器再打包（保证 SQLite 备份一致性，完成后自动重启）；`PAUSE_FOR_BACKUP=0` 可跳过停机。本地默认保留最近 5 份（`KEEP_BACKUPS` 可调）。

### 数据持久化

通过卷挂载到宿主机（docker-compose.yml 中定义，位于项目根目录）：

- `./data` → 容器 `/app/data`（SQLite 数据库）
- `./uploads` → 容器 `/app/uploads`（上传的图片与视频文件）

### 环境变量

| 变量 | 说明 | 必填 | 默认 |
|------|------|------|------|
| `PORT` | 服务监听 / 宿主机映射端口 | 否 | 后端 `3001`；docker-compose 默认 `80` |
| `JWT_SECRET` | JWT 签名密钥 | **是** | （无默认；后端未设置时启动失败，compose 未设置时拒绝启动） |
| `KEY_SECRET` | 访问密钥加密存储的派生密钥；不设置则复用 `JWT_SECRET` | 否 | 复用 `JWT_SECRET` |
| `VITE_API_URL` | 前端构建时使用的 API 地址；留空则使用相对路径 `/api`（同源部署）。跨域时填完整 URL | 否 | `/api` |
| `DATABASE_PATH` | SQLite 数据库文件路径 | 否 | `./data/photo-album.sqlite` |
| `UPLOAD_DIR` | 上传图片存储目录 | 否 | `./uploads` |
| `RECYCLE_RETENTION_DAYS` | 回收站保留天数，超期自动彻底删除；设为 `0` 或负数关闭自动清理 | 否 | `30` |

修改 `.env` 后需要 `docker-compose up -d --build` 重新构建（仅 `VITE_API_URL` 影响前端构建产物；`PORT` / `JWT_SECRET` 在容器启动时读取）。

## 项目结构

```
photo-album/
├── backend/                          # 后端
│   ├── src/
│   │   ├── entity/                   # TypeORM 实体
│   │   │   ├── AccessKey.ts
│   │   │   ├── Album.ts
│   │   │   ├── Image.ts
│   │   │   ├── Tag.ts
│   │   │   ├── ImageTag.ts
│   │   │   ├── Slideshow.ts
│   │   │   └── SlideshowImage.ts
│   │   ├── routes/                   # API 路由
│   │   │   ├── auth.ts
│   │   │   ├── accessKeys.ts
│   │   │   ├── albums.ts
│   │   │   ├── images.ts
│   │   │   ├── tags.ts
│   │   │   ├── slideshows.ts
│   │   │   └── recycleBin.ts
│   │   ├── middleware/auth.ts
│   │   ├── middleware/asyncHandler.ts
│   │   ├── data-source.ts
│   │   ├── httpError.ts
│   │   ├── keyCrypto.ts              # 访问密钥加密 / 查找摘要
│   │   ├── purgeService.ts           # 彻底删除与回收站到期清理
│   │   ├── storage.ts
│   │   └── index.ts
│   ├── data/                         # SQLite 数据库文件（运行时生成）
│   └── uploads/                      # 上传图片存储（运行时生成）
├── src/                              # 前端
│   ├── components/
│   │   ├── AlbumCard.tsx
│   │   ├── ImageCard.tsx
│   │   ├── VideoBadge.tsx
│   │   ├── Toast.tsx
│   │   ├── UploadZone.tsx
│   │   ├── TagPill.tsx
│   │   ├── SlideshowCard.tsx
│   │   ├── TransitionPreview.tsx
│   │   ├── Modal.tsx
│   │   ├── Layout.tsx
│   │   └── Sidebar.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Home.tsx                  # 相册列表主页
│   │   ├── AlbumDetail.tsx           # 相册详情（分页、上传、批量打标签等）
│   │   ├── ImagePreview.tsx
│   │   ├── Tags.tsx                  # 标签筛选页
│   │   ├── RecycleBin.tsx            # 回收站（恢复 / 彻底删除）
│   │   ├── SlideshowEdit.tsx
│   │   ├── SlideshowPlay.tsx
│   │   └── AccessKeys.tsx            # 访问密钥管理（ADMIN）
│   ├── lib/
│   │   ├── api.ts                    # API 封装（含类型定义与 401 全局处理）
│   │   ├── toastStore.ts             # 全局操作反馈 Toast
│   │   ├── videoPoster.ts            # 视频封面帧提取（浏览器端）
│   │   ├── imageFilter.ts            # 标签/搜索纯函数过滤
│   │   ├── constants.ts              # 共享常量（权限文案、标签调色板、转场文案）
│   │   └── utils.ts
│   ├── App.tsx
│   └── main.tsx
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## 权限模型

| 权限 | 能力 |
|------|------|
| VIEWER | 只读：浏览相册、图片、标签、轮播 |
| EDITOR | 上传 / 删除图片与相册、增删标签、编辑轮播 |
| ADMIN | EDITOR + 管理访问密钥 |

接口侧通过 `authenticate` + `requirePermission` 中间件强制；前端侧按 `permission` 隐藏不可用操作。

## API 一览

所有接口以 `/api` 为前缀，需在 Header 携带 `Authorization: Bearer <token>`（除登录接口外；图片文件接口也支持 `?token=` 查询参数）。

> `<img>` 等标签无法携带请求头，前端会先调用 `/auth/media-token` 换取一个 **10 分钟有效的短期媒体令牌**拼进图片 URL——即使随 URL 进入访问日志或浏览器历史，泄露价值也很有限。媒体令牌只能访问图片文件与缩略图，不能调用任何数据接口。

| 模块 | 路径 | 方法 | 权限 | 说明 |
|------|------|------|------|------|
| 认证 | `/auth/login` | POST | 公开（限流） | 同一 IP 5 分钟内最多失败 10 次 |
| 认证 | `/auth/validate` | POST | 任意已登录 | |
| 认证 | `/auth/media-token` | POST | 任意已登录 | 签发 10 分钟有效的媒体令牌，仅可用于图片 URL |
| 密钥 | `/access-keys` | GET / POST | ADMIN | 密钥加密存储（见「安全说明」），列表返回可读密钥 |
| 密钥 | `/access-keys/:id` | PUT / DELETE | ADMIN | 不能禁用/删除最后一个启用的管理员密钥 |
| 密钥 | `/access-keys/:id/key` | PATCH | ADMIN 或本人 | 修改自己的密钥后旧 token 失效，需重新登录 |
| 相册 | `/albums` | GET / POST | GET 任意 / POST EDITOR+ | 列表每项含 `imageCount` |
| 相册 | `/albums/:id` | GET / PUT / DELETE | GET 任意 / 写 EDITOR+ | DELETE 为软删除（移入回收站） |
| 图片 | `/images` | GET | 任意 | 全部图片（标签筛选页用）；支持 `?page=&limit=`（≤500）分页，返回 `{items,total,page,limit,totalPages}` 信封，不传则一次拉全量 |
| 图片 | `/images/recent?limit=8` | GET | 任意 | 最近上传 |
| 图片 | `/images/album/:albumId` | GET | 任意 | 相册图片；分页参数同上 |
| 图片 | `/images/:id/meta` | GET | 任意 | 图片元数据（JSON，含宽高） |
| 图片 | `/images/:id/thumbnail` | GET | 任意（媒体令牌可用） | 网格缩略图（WebP，首次按需生成后落盘缓存）；视频返回上传时截取的封面帧 |
| 图片 | `/images/:id` | GET | 任意（媒体令牌可用） | 媒体文件本体（带一天浏览器缓存头；支持 Range 请求，视频可拖动进度条） |
| 图片 | `/images` | POST | EDITOR+ | 图片（字段 `image`，≤ 20MB）或视频（字段 `video`，≤ 500MB，可附 `poster` 封面帧与宽高/时长）；图片记录真实宽高并预生成缩略图 |
| 图片 | `/images/:id` | DELETE | EDITOR+ | 软删除（移入回收站） |
| 回收站 | `/recycle-bin` | GET / DELETE | EDITOR+ | GET 返回各条目的 `autoPurgeAt`（到期自动删除时间）；DELETE 为清空回收站 |
| 回收站 | `/recycle-bin/albums/:id` | DELETE | EDITOR+ | 彻底删除相册及图片文件 |
| 回收站 | `/recycle-bin/albums/:id/restore` | POST | EDITOR+ | 恢复相册（图片一并恢复） |
| 回收站 | `/recycle-bin/images/:id` | DELETE | EDITOR+ | 彻底删除单张图片 |
| 回收站 | `/recycle-bin/images/:id/restore` | POST | EDITOR+ | 恢复图片 |
| 标签 | `/tags` | GET / POST | GET 任意 / POST EDITOR+ | |
| 标签 | `/tags/image-map` | GET | 任意 | 全量 imageId → 标签列表映射 |
| 标签 | `/tags/album/:albumId` | GET | 任意 | 相册内 imageId → 标签列表映射 |
| 标签 | `/tags/image/:imageId` | GET | 任意 | |
| 标签 | `/tags/image/:imageId` | POST | EDITOR+ | |
| 标签 | `/tags/:id` | DELETE | EDITOR+ | |
| 标签 | `/tags/image/:imageId/:tagId` | DELETE | EDITOR+ | |
| 轮播 | `/slideshows` | GET / POST | GET 任意 / POST EDITOR+ | 列表每项含 `imageCount` |
| 轮播 | `/slideshows/:id` | GET / PUT / DELETE | GET 任意 / 写 EDITOR+ | |

## 安全说明

- **访问密钥加密存储**：数据库中 `key` 列保存 HMAC-SHA256 查找摘要、`keyEnc` 列保存 AES-256-GCM 密文——SQLite 文件单独泄露拿不到密钥明文，管理员界面仍可查看/复制（由服务端用派生密钥解密返回）。旧版明文数据在下次成功登录时自动迁移，无需手动处理。
- **注意**：更换 `JWT_SECRET`（或 `KEY_SECRET`）会使已存储的密钥无法匹配/解密，相当于重置全部访问密钥，需要重建数据库或手动修数。
- **图片 URL 使用短期媒体令牌**（10 分钟），完整 JWT 不再出现在 URL 中；媒体令牌只能访问媒体文件，不能调用数据接口。
- 登录接口有基于 IP 的失败限流；上传仅允许常见图片格式（≤ 20MB）与常见视频格式（≤ 500MB）。

## 设计风格

- **主色**：暖橙 `#E8845C`
- **背景**：深灰渐变 `#1A1A2E` → `#16213E`
- **布局**：左侧栏 + 右侧内容，卡片式
- **图标**：Lucide 线性图标

## 数据自动维护

后端在以下场景自动维护数据一致性，**不需要客户端介入**：

- 上传图片时：若相册无封面且这是首张图，自动设为封面
- 删除图片 / 相册时：软删除（移入回收站），物理文件保留可恢复
- **回收站条目超过保留期（默认 30 天）后：后端每小时自动彻底删除**（文件、缩略图与轮播引用一并清理）
- 彻底删除（回收站中删除或清空）时：清理磁盘文件、缩略图，并清理引用该图的轮播条目
- 删除标签时：清理所有图片与该标签的关联
- （客户端在删除封面图时同样会处理封面顺延 / 清空）

## 核心流程

1. **登录**：访问首页 → 输入密钥 → 进入系统
2. **管理相册**：主页 → 新建相册 → 进入详情 → 上传图片（首张自动为封面）→ 批量打标签
3. **筛选浏览**：标签页 → 选择标签组合 → 查看匹配图片
4. **轮播**：轮播编辑 → 选图 + 配置 → 播放
5. **管理密钥**（ADMIN）：访问密钥页 → 创建 / 调整权限

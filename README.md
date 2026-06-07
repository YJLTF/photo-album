# 个人相册应用（服务版）

一款面向个人用户的图片管理工具，支持图片上传、预览、相册分类、标签管理与自定义轮播播放。数据存放在服务器端，通过访问密码进行权限控制。

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

### 🖼️ 图片管理
- 拖拽或点击上传（支持批量）
- 网格展示
- 全屏预览（缩放、左右切换）
- 单张 / 批量删除（删除封面图时自动顺延到剩余的第一张）

### 🏷️ 标签管理
- 为图片添加 / 移除标签
- 多标签组合筛选
- 每个标签可拥有自己的颜色（创建时自动从调色板分配）
- 标签页内可视化管理、创建、删除

### 🎬 轮播功能
- 从相册中选择轮播图片
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
- **框架**：Express + TypeScript
- **数据库**：SQLite + TypeORM
- **认证**：JWT（jsonwebtoken + bcrypt）
- **文件上传**：Multer
- **校验**：Zod

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

> 首次启动会自动在 `data/photo-album.sqlite` 创建数据库，并插入默认管理员密钥 `admin123`。**生产环境请立即修改或删除。**

### 2. 启动前端

```bash
npm install
npm run dev
```

默认运行在 `http://localhost:5173`。若后端端口非 3001，可通过根目录 `.env` 中的 `VITE_API_URL` 覆盖。

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

3. 浏览器访问 `http://localhost:3001`，使用首次启动自动生成的密钥 `admin123` 登录（**登录后请立即在「访问密钥」页面修改或新增**）。

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

### 数据持久化

通过卷挂载到宿主机：

- `./data` → 容器 `/app/data`（SQLite 数据库）
- `./uploads` → 容器 `/app/uploads`（上传的图片文件）

### 环境变量

| 变量 | 说明 | 必填 | 默认 |
|------|------|------|------|
| `PORT` | 服务监听 / 宿主机映射端口 | 否 | `3001` |
| `JWT_SECRET` | JWT 签名密钥 | **是** | （无默认，未设置时启动失败） |
| `VITE_API_URL` | 前端构建时使用的 API 地址；留空则使用相对路径 `/api`（同源部署）。跨域时填完整 URL | 否 | `/api` |

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
│   │   │   └── slideshows.ts
│   │   ├── middleware/auth.ts
│   │   ├── data-source.ts
│   │   └── index.ts
│   ├── data/                         # SQLite 数据库文件（运行时生成）
│   └── uploads/                      # 上传图片存储（运行时生成）
├── src/                              # 前端
│   ├── components/
│   │   ├── AlbumCard.tsx
│   │   ├── ImageCard.tsx
│   │   ├── UploadZone.tsx
│   │   ├── TagPill.tsx
│   │   ├── SlideshowCard.tsx
│   │   ├── TransitionPreview.tsx
│   │   ├── Modal.tsx
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Empty.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Home.tsx                  # 相册列表主页
│   │   ├── AlbumDetail.tsx           # 相册详情（上传、批量打标签等）
│   │   ├── ImagePreview.tsx
│   │   ├── Tags.tsx                  # 标签筛选页
│   │   ├── SlideshowEdit.tsx
│   │   ├── SlideshowPlay.tsx
│   │   └── AccessKeys.tsx            # 访问密钥管理（ADMIN）
│   ├── hooks/useTheme.ts
│   ├── lib/
│   │   ├── api.ts                    # API 封装
│   │   ├── types.ts
│   │   ├── utils.ts
│   │   ├── db.ts                     # IndexedDB 工具（当前未使用，预留给离线）
│   │   └── store.ts                  # Dexie 封装（同上）
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

所有接口以 `/api` 为前缀，需在 Header 携带 `Authorization: Bearer <token>`（除登录接口外）。

| 模块 | 路径 | 方法 | 权限 |
|------|------|------|------|
| 认证 | `/auth/login` | POST | 公开 |
| 认证 | `/auth/validate` | POST | 任意已登录 |
| 密钥 | `/access-keys` | GET / POST | GET 任意 / POST ADMIN |
| 密钥 | `/access-keys/:id` | PUT / DELETE | ADMIN |
| 密钥 | `/access-keys/:id/key` | PATCH | ADMIN |
| 相册 | `/albums` | GET / POST | GET 任意 / POST EDITOR+ |
| 相册 | `/albums/:id` | GET / PUT / DELETE | GET 任意 / 写 EDITOR+ |
| 图片 | `/images/album/:albumId` | GET | 任意 |
| 图片 | `/images/:id` | GET（文件） | 任意 |
| 图片 | `/images` | POST | EDITOR+ |
| 图片 | `/images/:id` | DELETE | EDITOR+ |
| 标签 | `/tags` | GET | 任意 |
| 标签 | `/tags/image/:imageId` | GET | 任意 |
| 标签 | `/tags` | POST | EDITOR+ |
| 标签 | `/tags/image/:imageId` | POST | EDITOR+ |
| 标签 | `/tags/:id` | DELETE | EDITOR+ |
| 标签 | `/tags/image/:imageId/:tagId` | DELETE | EDITOR+ |
| 轮播 | `/slideshows` | GET / POST | GET 任意 / POST EDITOR+ |
| 轮播 | `/slideshows/:id` | GET / PUT / DELETE | GET 任意 / 写 EDITOR+ |

## 设计风格

- **主色**：暖橙 `#E8845C`
- **背景**：深灰渐变 `#1A1A2E` → `#16213E`
- **布局**：左侧栏 + 右侧内容，卡片式
- **图标**：Lucide 线性图标

## 数据自动维护

后端在以下场景会自动维护相册封面的合法性，**不需要客户端介入**：

- 上传图片时：若相册无封面且这是首张图，自动设为封面
- （客户端 `handleDeleteImage` 同样会处理封面顺延 / 清空）

## 核心流程

1. **登录**：访问首页 → 输入密钥 → 进入系统
2. **管理相册**：主页 → 新建相册 → 进入详情 → 上传图片（首张自动为封面）→ 批量打标签
3. **筛选浏览**：标签页 → 选择标签组合 → 查看匹配图片
4. **轮播**：轮播编辑 → 选图 + 配置 → 播放
5. **管理密钥**（ADMIN）：访问密钥页 → 创建 / 调整权限

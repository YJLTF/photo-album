import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { IsNull } from "typeorm";
import { AppDataSource } from "../data-source";
import { Image } from "../entity/Image";
import { Album } from "../entity/Album";
import { authenticate, authenticateMedia, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../httpError";
import { STORAGE_DIR, THUMBS_DIR } from "../storage";
import { posterFilesOf } from "../purgeService";

const router = Router();

// 允许的媒体类型（svg 可携带脚本，排除）。视频体积大，multer 全局上限按视频放宽，
// 图片的 20MB 限制在入库前单独校验（见 POST /）。
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/avif",
]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
  "video/ogg",
]);
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

// 浏览器截取的封面帧可能编码为 webp / jpeg / png，按实际类型落盘
const POSTER_EXT_BY_MIME: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype) || ALLOWED_VIDEO_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError(400, "仅支持上传 JPG / PNG / GIF / WebP / BMP / AVIF 图片，或 MP4 / WebM / MOV / MKV / AVI 等格式视频"));
    }
  }
});

// 分页参数：仅当显式传入 limit 时启用分页（上限 500），否则返回全量（供标签页/预览页一次拉取）
const parsePaging = (query: Record<string, unknown>): { page: number; limit: number } | null => {
  const limit = Math.floor(Number(query.limit));
  if (!Number.isFinite(limit) || limit < 1) return null;
  const page = Math.floor(Number(query.page));
  return {
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 100000) : 1,
    limit: Math.min(limit, 500),
  };
};

const paged = <T>(items: T[], total: number, paging: { page: number; limit: number } | null) => ({
  items,
  total,
  page: paging?.page ?? 1,
  limit: paging?.limit ?? Math.max(total, 1),
  totalPages: paging ? Math.max(Math.ceil(total / paging.limit), 1) : 1,
});

// 所有图片（供标签筛选页一次性拉取；不含回收站中的图片）。传 page+limit 时返回分页信封
router.get("/", authenticate, asyncHandler(async (req, res) => {
  const paging = parsePaging(req.query);
  const repo = AppDataSource.getRepository(Image);
  if (paging) {
    const [items, total] = await repo.findAndCount({
      where: { deletedAt: IsNull() },
      order: { createdAt: "DESC" },
      skip: (paging.page - 1) * paging.limit,
      take: paging.limit,
    });
    return res.json(paged(items, total, paging));
  }
  const items = await repo.find({ where: { deletedAt: IsNull() }, order: { createdAt: "DESC" } });
  res.json(paged(items, items.length, null));
}));

// 最近上传的图片（注意：必须注册在 /:id 之前，否则 "recent" 会被当成 id）
router.get("/recent", authenticate, asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 8, 1), 50);
  const images = await AppDataSource.getRepository(Image)
    .find({ where: { deletedAt: IsNull() }, order: { createdAt: "DESC" }, take: limit });
  res.json(images);
}));

router.get("/album/:albumId", authenticate, asyncHandler(async (req, res) => {
  const albumId = String(req.params.albumId);
  const paging = parsePaging(req.query);
  const repo = AppDataSource.getRepository(Image);
  if (paging) {
    const [items, total] = await repo.findAndCount({
      where: { albumId, deletedAt: IsNull() },
      order: { createdAt: "ASC" },
      skip: (paging.page - 1) * paging.limit,
      take: paging.limit,
    });
    return res.json(paged(items, total, paging));
  }
  const items = await repo.find({ where: { albumId, deletedAt: IsNull() }, order: { createdAt: "ASC" } });
  res.json(paged(items, items.length, null));
}));

// 图片元数据（文件本体走 GET /:id，这里返回 JSON，供预览页反查所属相册）
router.get("/:id/meta", authenticate, asyncHandler(async (req, res) => {
  const image = await AppDataSource.getRepository(Image).findOne({ where: { id: String(req.params.id) } });
  if (!image) {
    throw new HttpError(404, "Image not found");
  }
  res.json(image);
}));

// 缩略图：网格卡片 ~300px、2 倍屏足够；生成后落盘缓存，内容不可变
const THUMB_MAX_SIZE = 640;
const thumbFileOf = (filePath: string) => `${filePath}.webp`;

// 异步探测文件存在性：请求热路径避免同步 IO 阻塞事件循环
const fileExists = async (p: string): Promise<boolean> => {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
};

// 生成（若不存在）并返回缩略图路径；tmp 文件先写后改名，避免并发请求读到半成品
const ensureThumbnail = async (originalFile: string): Promise<string> => {
  const thumbPath = path.join(THUMBS_DIR, thumbFileOf(path.basename(originalFile)));
  if (await fileExists(thumbPath)) return thumbPath;

  const tmpPath = `${thumbPath}.${crypto.randomUUID()}.tmp`;
  await sharp(originalFile)
    .rotate() // 按 EXIF 方向自动摆正
    .resize(THUMB_MAX_SIZE, THUMB_MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(tmpPath);
  await fs.promises.rename(tmpPath, thumbPath);
  return thumbPath;
};

// 读取图片真实尺寸（metadata 只读文件头，开销极小）；竖拍照片按 EXIF 方向交换宽高
const readDimensions = async (file: string): Promise<{ width: number; height: number }> => {
  try {
    const meta = await sharp(file).metadata();
    let width = meta.width ?? 0;
    let height = meta.height ?? 0;
    if ((meta.orientation ?? 1) >= 5 && (meta.orientation ?? 1) <= 8) {
      [width, height] = [height, width];
    }
    return { width, height };
  } catch {
    return { width: 0, height: 0 };
  }
};

// 网格缩略图。相机原片单张可达 10MB+，网格直接加载原图是页面卡顿的主因；
// 首次请求时按需生成，之后直接返回缓存文件。
router.get("/:id/thumbnail", authenticateMedia, asyncHandler(async (req, res) => {
  const image = await AppDataSource.getRepository(Image).findOne({ where: { id: String(req.params.id) } });
  if (!image) {
    throw new HttpError(404, "Image not found");
  }

  const originalPath = path.join(STORAGE_DIR, image.filePath);
  if (!(await fileExists(originalPath))) {
    throw new HttpError(404, "Image file not found");
  }

  // 视频：sharp 无法转码，返回上传时浏览器截取的封面帧；没有则 404，由前端显示占位图标
  if (image.type === "video") {
    for (const posterPath of posterFilesOf(image.filePath)) {
      if (!(await fileExists(posterPath))) continue;
      res.setHeader("Cache-Control", "private, max-age=604800");
      res.setHeader(
        "Content-Type",
        posterPath.endsWith(".webp") ? "image/webp" : posterPath.endsWith(".jpg") ? "image/jpeg" : "image/png"
      );
      return res.sendFile(posterPath);
    }
    throw new HttpError(404, "Video poster not found");
  }

  try {
    const thumbPath = await ensureThumbnail(originalPath);
    res.setHeader("Cache-Control", "private, max-age=604800");
    res.setHeader("Content-Type", "image/webp");
    res.sendFile(thumbPath);
  } catch {
    // 个别格式转码失败时回退原图，保证网格仍能显示
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.sendFile(originalPath);
  }
}));

router.get("/:id", authenticateMedia, asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const image = await AppDataSource.getRepository(Image).findOne({ where: { id } });

  if (!image) {
    throw new HttpError(404, "Image not found");
  }

  const filePath = path.join(STORAGE_DIR, image.filePath);
  if (!(await fileExists(filePath))) {
    throw new HttpError(404, "Image file not found");
  }

  // 内容按 id 永不变化，允许浏览器缓存一天，避免每次刷新全量重新下载；
  // res.sendFile 基于 send 库，自动处理 Range 请求（视频拖动进度条依赖它）
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (image.mimeType) {
    res.setHeader("Content-Type", image.mimeType);
  }
  res.sendFile(filePath);
}));

// 浏览器按 UTF-8 原始字节发送 multipart 文件名，而 multer/busboy 默认按 latin1 解码，
// 中文名会变成 "ÖÐÎÄ..." 式乱码；将 latin1 字节还原回 UTF-8。
// 已是正常 Unicode（含 >0xFF 字符）或转换后出现替代符的（本就不是 UTF-8 字节）保持原样。
const fixMojibakeName = (name: string): string => {
  if (/[^\x00-\xff]/.test(name)) return name;
  const fixed = Buffer.from(name, "latin1").toString("utf8");
  return fixed.includes("\uFFFD") || fixed === name ? name : fixed;
};

router.post(
  "/",
  authenticate,
  requirePermission("editor"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "poster", maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const { albumId } = req.body;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const file = files?.image?.[0] ?? files?.video?.[0];
    const poster = files?.poster?.[0];

    if (!albumId || !file) {
      throw new HttpError(400, "Album ID and image are required");
    }

    // 前端会随表单附带 UTF-8 的 name 字段（文本字段不存在文件名解码问题），优先采用；
    // 其他客户端（如 curl）没有该字段时回退到 originalname 并尝试还原乱码
    const requestedName = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const name = requestedName || fixMojibakeName(file.originalname);

    // 按上传内容判断类型（不依赖字段名，旧客户端把视频放进 image 字段也能正确入库）
    const isVideo = file.mimetype.startsWith("video/");
    // multer 全局上限按视频放宽，图片的 20MB 限制在这里补校验
    if (!isVideo && file.size > MAX_IMAGE_SIZE) {
      await fs.promises.unlink(file.path).catch(() => {});
      throw new HttpError(400, "图片最大 20MB");
    }

    const album = await AppDataSource.getRepository(Album).findOne({ where: { id: albumId } });
    if (!album) {
      // 文件已被 multer 落盘，相册不存在时删掉，避免磁盘积累孤儿文件
      await fs.promises.unlink(file.path).catch(() => {});
      throw new HttpError(404, "Album not found");
    }

    const image = new Image();
    image.albumId = albumId;
    image.name = name;
    image.filePath = file.filename;
    image.fileSize = file.size;
    image.mimeType = file.mimetype;
    image.type = isVideo ? "video" : "image";

    if (isVideo) {
      // 视频的尺寸/时长由浏览器在截取封面帧时读取（服务端没有 ffmpeg，不做转码）
      const duration = Number(req.body.duration);
      image.width = Math.max(Math.floor(Number(req.body.width)) || 0, 0);
      image.height = Math.max(Math.floor(Number(req.body.height)) || 0, 0);
      image.duration = Number.isFinite(duration) && duration > 0 ? duration : null;

      // 封面帧与图片缩略图一样放 THUMBS_DIR，按实际编码选择扩展名
      if (poster) {
        const ext = POSTER_EXT_BY_MIME[poster.mimetype] ?? ".png";
        const posterPath = path.join(THUMBS_DIR, `${file.filename}.poster${ext}`);
        await fs.promises.rename(poster.path, posterPath)
          .catch(() => fs.promises.unlink(poster.path).catch(() => {}));
      }
    } else {
      const dims = await readDimensions(file.path);
      image.width = dims.width;
      image.height = dims.height;
      image.duration = null;
    }

    await AppDataSource.getRepository(Image).save(image);

    // 后台预生成缩略图，首批网格加载时无需逐张现场转码（失败不影响上传，路由会按需重试）
    if (!isVideo) {
      ensureThumbnail(file.path).catch(() => {});
    }

    // 如果相册还没有封面且这是第一张（未删除的）图片，则自动设为封面。
    // 计数必须排除回收站中的图片：清空相册后重新上传时，否则回收站里的
    // 旧图会把计数顶到 2，导致封面永远不会自动设置
    if (!album.coverImageId) {
      const imageCount = await AppDataSource.getRepository(Image).count({
        where: { albumId, deletedAt: IsNull() },
      });
      if (imageCount === 1) {
        album.coverImageId = image.id;
        await AppDataSource.getRepository(Album).save(album);
      }
    }

    res.status(201).json(image);
  })
);

// 删除图片 = 软删除（移入回收站）：物理文件与缩略图保留，可在回收站恢复；
// 轮播引用暂不清理（文件仍可读，播放不受影响），彻底删除时才一并清理
router.delete("/:id", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);

  const image = await AppDataSource.getRepository(Image).findOne({ where: { id, deletedAt: IsNull() } });
  if (!image) {
    throw new HttpError(404, "Image not found");
  }

  await AppDataSource.getRepository(Image).update({ id }, { deletedAt: new Date() });

  // 删除的是相册封面时由服务端顺延到剩余第一张（或清空），
  // 不依赖客户端处理，避免其他客户端 / API 直接删除时封面悬空
  const album = await AppDataSource.getRepository(Album).findOne({ where: { id: image.albumId } });
  if (album && album.coverImageId === id) {
    const next = await AppDataSource.getRepository(Image).findOne({
      where: { albumId: album.id, deletedAt: IsNull() },
      order: { createdAt: "ASC" },
    });
    album.coverImageId = next ? next.id : null;
    await AppDataSource.getRepository(Album).save(album);
  }

  res.json({ message: "Image moved to recycle bin" });
}));

export default router;

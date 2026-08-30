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

const router = Router();

// 只允许图片类型（svg 可携带脚本，排除），单文件最大 20MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/avif",
]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

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
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError(400, "仅支持上传 JPG / PNG / GIF / WebP / BMP / AVIF 图片"));
    }
  }
});

// 所有图片（供标签筛选页一次性拉取；不含回收站中的图片）
router.get("/", authenticate, asyncHandler(async (req, res) => {
  const images = await AppDataSource.getRepository(Image)
    .find({ where: { deletedAt: IsNull() }, order: { createdAt: "DESC" } });
  res.json(images);
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
  const images = await AppDataSource.getRepository(Image)
    .find({ where: { albumId, deletedAt: IsNull() }, order: { createdAt: "ASC" } });
  res.json(images);
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

// 生成（若不存在）并返回缩略图路径；tmp 文件先写后改名，避免并发请求读到半成品
const ensureThumbnail = async (originalFile: string): Promise<string> => {
  const thumbPath = path.join(THUMBS_DIR, thumbFileOf(path.basename(originalFile)));
  if (fs.existsSync(thumbPath)) return thumbPath;

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
  if (!fs.existsSync(originalPath)) {
    throw new HttpError(404, "Image file not found");
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
  if (!fs.existsSync(filePath)) {
    throw new HttpError(404, "Image file not found");
  }

  // 图片内容按 id 永不变化，允许浏览器缓存一天，避免每次刷新全量重新下载
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (image.mimeType) {
    res.setHeader("Content-Type", image.mimeType);
  }
  res.sendFile(filePath);
}));

router.post("/", authenticate, requirePermission("editor"), upload.single("image"), asyncHandler(async (req, res) => {
  const { albumId } = req.body;
  const file = req.file;

  if (!albumId || !file) {
    throw new HttpError(400, "Album ID and image are required");
  }

  const album = await AppDataSource.getRepository(Album).findOne({ where: { id: albumId } });
  if (!album) {
    throw new HttpError(404, "Album not found");
  }

  const image = new Image();
  image.albumId = albumId;
  image.name = file.originalname;
  image.filePath = file.filename;
  image.fileSize = file.size;
  image.mimeType = file.mimetype;
  const dims = await readDimensions(file.path);
  image.width = dims.width;
  image.height = dims.height;

  await AppDataSource.getRepository(Image).save(image);

  // 后台预生成缩略图，首批网格加载时无需逐张现场转码（失败不影响上传，路由会按需重试）
  ensureThumbnail(file.path).catch(() => {});

  // 如果相册还没有封面且这是第一张图片，则自动设为封面
  if (!album.coverImageId) {
    const imageCount = await AppDataSource.getRepository(Image).count({ where: { albumId } });
    if (imageCount === 1) {
      album.coverImageId = image.id;
      await AppDataSource.getRepository(Album).save(album);
    }
  }

  res.status(201).json(image);
}));

// 删除图片 = 软删除（移入回收站）：物理文件与缩略图保留，可在回收站恢复；
// 轮播引用暂不清理（文件仍可读，播放不受影响），彻底删除时才一并清理
router.delete("/:id", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);

  const image = await AppDataSource.getRepository(Image).findOne({ where: { id, deletedAt: IsNull() } });
  if (!image) {
    throw new HttpError(404, "Image not found");
  }

  await AppDataSource.getRepository(Image).update({ id }, { deletedAt: new Date() });

  res.json({ message: "Image moved to recycle bin" });
}));

export default router;

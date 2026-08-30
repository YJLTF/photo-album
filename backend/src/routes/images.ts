import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { AppDataSource } from "../data-source";
import { Image } from "../entity/Image";
import { Album } from "../entity/Album";
import { SlideshowImage } from "../entity/SlideshowImage";
import { authenticate, requirePermission } from "../middleware/auth";
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

// 所有图片（供标签筛选页一次性拉取）
router.get("/", authenticate, asyncHandler(async (req, res) => {
  const images = await AppDataSource.getRepository(Image)
    .find({ order: { createdAt: "DESC" } });
  res.json(images);
}));

// 最近上传的图片（注意：必须注册在 /:id 之前，否则 "recent" 会被当成 id）
router.get("/recent", authenticate, asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 8, 1), 50);
  const images = await AppDataSource.getRepository(Image)
    .find({ order: { createdAt: "DESC" }, take: limit });
  res.json(images);
}));

router.get("/album/:albumId", authenticate, asyncHandler(async (req, res) => {
  const albumId = String(req.params.albumId);
  const images = await AppDataSource.getRepository(Image)
    .find({ where: { albumId }, order: { createdAt: "ASC" } });
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

// 网格缩略图。相机原片单张可达 10MB+，网格直接加载原图是页面卡顿的主因；
// 首次请求时按需生成，之后直接返回缓存文件。
router.get("/:id/thumbnail", authenticate, asyncHandler(async (req, res) => {
  const image = await AppDataSource.getRepository(Image).findOne({ where: { id: String(req.params.id) } });
  if (!image) {
    throw new HttpError(404, "Image not found");
  }

  const originalPath = path.join(STORAGE_DIR, image.filePath);
  const thumbPath = path.join(THUMBS_DIR, thumbFileOf(image.filePath));

  if (!fs.existsSync(thumbPath)) {
    if (!fs.existsSync(originalPath)) {
      throw new HttpError(404, "Image file not found");
    }
    try {
      const tmpPath = `${thumbPath}.${Date.now()}.tmp`;
      await sharp(originalPath)
        .rotate() // 按 EXIF 方向自动摆正
        .resize(THUMB_MAX_SIZE, THUMB_MAX_SIZE, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(tmpPath);
      await fs.promises.rename(tmpPath, thumbPath);
    } catch {
      // 个别格式转码失败时回退原图，保证网格仍能显示
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.sendFile(originalPath);
      return;
    }
  }

  res.setHeader("Cache-Control", "private, max-age=604800");
  res.setHeader("Content-Type", "image/webp");
  res.sendFile(thumbPath);
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
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
  image.width = 0;
  image.height = 0;

  await AppDataSource.getRepository(Image).save(image);

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

router.delete("/:id", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);

  const image = await AppDataSource.getRepository(Image).findOne({ where: { id } });
  if (!image) {
    throw new HttpError(404, "Image not found");
  }

  // 同步清理轮播引用，避免播放时 404
  await AppDataSource.getRepository(SlideshowImage).delete({ imageId: id });
  await AppDataSource.getRepository(Image).delete(id);

  // 物理文件删除失败不影响接口结果（仅占用磁盘）
  await fs.promises.unlink(path.join(STORAGE_DIR, image.filePath)).catch(() => {});
  await fs.promises.unlink(path.join(THUMBS_DIR, thumbFileOf(image.filePath))).catch(() => {});

  res.json({ message: "Image deleted" });
}));

export default router;

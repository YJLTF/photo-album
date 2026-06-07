import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { AppDataSource } from "../data-source";
import { Image } from "../entity/Image";
import { Album } from "../entity/Album";
import { authenticate, requirePermission } from "../middleware/auth";
import { PermissionLevel } from "../entity/AccessKey";

const router = Router();

const STORAGE_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({ storage });

router.get("/album/:albumId", authenticate, async (req, res) => {
  const albumId = String(req.params.albumId);
  const images = await AppDataSource.getRepository(Image)
    .find({ where: { albumId }, order: { createdAt: "ASC" } });
  res.json(images);
});

router.get("/:id", authenticate, async (req, res) => {
  const id = String(req.params.id);
  const image = await AppDataSource.getRepository(Image).findOne({ where: { id } });
  
  if (!image) {
    return res.status(404).json({ message: "Image not found" });
  }

  const filePath = path.join(STORAGE_DIR, image.filePath);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Image file not found" });
  }

  res.sendFile(filePath);
});

router.post("/", authenticate, requirePermission("editor"), upload.single("image"), async (req, res) => {
  const { albumId } = req.body;
  const file = req.file;

  if (!albumId || !file) {
    return res.status(400).json({ message: "Album ID and image are required" });
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
  const album = await AppDataSource.getRepository(Album).findOne({ where: { id: albumId } });
  if (album && !album.coverImageId) {
    const imageCount = await AppDataSource.getRepository(Image).count({ where: { albumId } });
    if (imageCount === 1) {
      album.coverImageId = image.id;
      await AppDataSource.getRepository(Album).save(album);
    }
  }

  res.status(201).json(image);
});

router.delete("/:id", authenticate, requirePermission("editor"), async (req, res) => {
  const id = String(req.params.id);

  const image = await AppDataSource.getRepository(Image).findOne({ where: { id } });
  if (!image) {
    return res.status(404).json({ message: "Image not found" });
  }

  const filePath = path.join(STORAGE_DIR, image.filePath);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await AppDataSource.getRepository(Image).delete(id);
  res.json({ message: "Image deleted" });
});

export default router;
import { Router } from "express";
import fs from "fs";
import path from "path";
import { In } from "typeorm";
import { AppDataSource } from "../data-source";
import { Album } from "../entity/Album";
import { Image } from "../entity/Image";
import { SlideshowImage } from "../entity/SlideshowImage";
import { authenticate, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../httpError";
import { STORAGE_DIR, THUMBS_DIR } from "../storage";

const router = Router();

const imageRepo = () => AppDataSource.getRepository(Image);
const albumRepo = () => AppDataSource.getRepository(Album);
const slideshowImageRepo = () => AppDataSource.getRepository(SlideshowImage);

// GROUP BY 一次查出每个相册的图片数，避免 N+1
const getImageCountMap = async (): Promise<Map<string, number>> => {
  const rows = await imageRepo()
    .createQueryBuilder("image")
    .select("image.albumId", "albumId")
    .addSelect("COUNT(*)", "cnt")
    .groupBy("image.albumId")
    .getRawMany<{ albumId: string; cnt: string | number }>();
  return new Map(rows.map(r => [r.albumId, Number(r.cnt)]));
};

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const [albums, countMap] = await Promise.all([
    albumRepo().find({ order: { createdAt: "ASC" } }),
    getImageCountMap(),
  ]);
  res.json(albums.map(a => ({ ...a, imageCount: countMap.get(a.id) ?? 0 })));
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const album = await albumRepo().findOne({ where: { id: String(req.params.id) } });
  if (!album) {
    throw new HttpError(404, "Album not found");
  }
  res.json(album);
}));

router.post("/", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    throw new HttpError(400, "Album name is required");
  }

  const album = new Album();
  album.name = name;
  await albumRepo().save(album);
  res.status(201).json(album);
}));

router.put("/:id", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { name, coverImageId } = req.body;

  const album = await albumRepo().findOne({ where: { id } });
  if (!album) {
    throw new HttpError(404, "Album not found");
  }

  if (typeof name === "string" && name.trim()) album.name = name.trim();
  if (coverImageId !== undefined) album.coverImageId = coverImageId;

  await albumRepo().save(album);
  res.json(album);
}));

router.delete("/:id", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);

  const album = await albumRepo().findOne({ where: { id } });
  if (!album) {
    throw new HttpError(404, "Album not found");
  }

  const images = await imageRepo().find({
    where: { albumId: id },
    select: ["id", "filePath"],
  });
  const imageIds = images.map(img => img.id);

  if (imageIds.length > 0) {
    await slideshowImageRepo().delete({ imageId: In(imageIds) });
  }
  await imageRepo().delete({ albumId: id });
  await albumRepo().delete(id);

  // 清理物理文件（失败不影响接口结果，仅占用磁盘）
  await Promise.all(
    images.flatMap(img => [
      fs.promises.unlink(path.join(STORAGE_DIR, img.filePath)).catch(() => {}),
      fs.promises.unlink(path.join(THUMBS_DIR, `${img.filePath}.webp`)).catch(() => {}),
    ])
  );

  res.json({ message: "Album deleted" });
}));

export default router;

import { Router } from "express";
import { IsNull } from "typeorm";
import { AppDataSource } from "../data-source";
import { Album } from "../entity/Album";
import { Image } from "../entity/Image";
import { authenticate, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../httpError";

const router = Router();

const imageRepo = () => AppDataSource.getRepository(Image);
const albumRepo = () => AppDataSource.getRepository(Album);

// GROUP BY 一次查出每个相册的未删除图片数，避免 N+1
const getImageCountMap = async (): Promise<Map<string, number>> => {
  const rows = await imageRepo()
    .createQueryBuilder("image")
    .select("image.albumId", "albumId")
    .addSelect("COUNT(*)", "cnt")
    .where("image.deletedAt IS NULL")
    .groupBy("image.albumId")
    .getRawMany<{ albumId: string; cnt: string | number }>();
  return new Map(rows.map(r => [r.albumId, Number(r.cnt)]));
};

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const [albums, countMap] = await Promise.all([
    albumRepo().find({ where: { deletedAt: IsNull() }, order: { createdAt: "ASC" } }),
    getImageCountMap(),
  ]);
  res.json(albums.map(a => ({ ...a, imageCount: countMap.get(a.id) ?? 0 })));
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const album = await albumRepo().findOne({ where: { id: String(req.params.id), deletedAt: IsNull() } });
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

  const album = await albumRepo().findOne({ where: { id, deletedAt: IsNull() } });
  if (!album) {
    throw new HttpError(404, "Album not found");
  }

  if (typeof name === "string" && name.trim()) album.name = name.trim();
  if (coverImageId !== undefined) {
    if (coverImageId === null || coverImageId === "") {
      album.coverImageId = null;
    } else {
      // 封面必须指向本相册内未删除的图片，防止悬空或跨相册引用
      const cover = await imageRepo().findOne({
        where: { id: String(coverImageId), albumId: id, deletedAt: IsNull() },
      });
      if (!cover) {
        throw new HttpError(400, "封面图片不存在或不属于该相册");
      }
      album.coverImageId = cover.id;
    }
  }

  await albumRepo().save(album);
  res.json(album);
}));

// 删除相册 = 软删除（移入回收站）：相册与其中图片一并标记，物理文件保留，
// 可在回收站恢复；彻底删除与文件清理由 /recycle-bin 接口负责
router.delete("/:id", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);

  const album = await albumRepo().findOne({ where: { id, deletedAt: IsNull() } });
  if (!album) {
    throw new HttpError(404, "Album not found");
  }

  const now = new Date();
  await albumRepo().update({ id }, { deletedAt: now });
  await imageRepo().update({ albumId: id, deletedAt: IsNull() }, { deletedAt: now });

  res.json({ message: "Album moved to recycle bin" });
}));

export default router;

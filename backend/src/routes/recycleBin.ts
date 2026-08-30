import { Router } from "express";
import { In, IsNull, Not } from "typeorm";
import { AppDataSource } from "../data-source";
import { Album } from "../entity/Album";
import { Image } from "../entity/Image";
import { authenticate, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../httpError";
import { autoPurgeAt, isAutoPurgeEnabled, purgeImages } from "../purgeService";

const router = Router();

const albumRepo = () => AppDataSource.getRepository(Album);
const imageRepo = () => AppDataSource.getRepository(Image);

const findDeletedAlbum = async (id: string) => {
  const album = await albumRepo().findOne({ where: { id, deletedAt: Not(IsNull()) } });
  if (!album) {
    throw new HttpError(404, "回收站中没有该相册");
  }
  return album;
};

const findDeletedImage = async (id: string) => {
  const image = await imageRepo().findOne({ where: { id, deletedAt: Not(IsNull()) } });
  if (!image) {
    throw new HttpError(404, "回收站中没有该图片");
  }
  return image;
};

// 回收站内容：相册条目（含随相册删除的图片数）+ 单独删除的图片（所属相册未删除）
router.get("/", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const [deletedAlbums, deletedImages, liveAlbums] = await Promise.all([
    albumRepo().find({ where: { deletedAt: Not(IsNull()) }, order: { deletedAt: "DESC" } }),
    imageRepo().find({ where: { deletedAt: Not(IsNull()) }, order: { deletedAt: "DESC" } }),
    albumRepo().find({ where: { deletedAt: IsNull() }, select: ["id", "name"] }),
  ]);

  const perAlbumCounts = await imageRepo()
    .createQueryBuilder("image")
    .select("image.albumId", "albumId")
    .addSelect("COUNT(*)", "cnt")
    .where("image.deletedAt IS NOT NULL")
    .groupBy("image.albumId")
    .getRawMany<{ albumId: string; cnt: string | number }>();
  const countMap = new Map(perAlbumCounts.map(r => [r.albumId, Number(r.cnt)]));

  const deletedAlbumIds = new Set(deletedAlbums.map(a => a.id));
  const albumNames = new Map([...deletedAlbums, ...liveAlbums].map(a => [a.id, a.name]));

  // autoPurgeAt：保留期内预计的彻底删除时间；自动清理关闭时为 null
  const purgeAtOf = (deletedAt: Date) =>
    isAutoPurgeEnabled() ? autoPurgeAt(deletedAt) : null;

  res.json({
    autoPurgeDisabled: !isAutoPurgeEnabled(),
    albums: deletedAlbums.map(a => ({
      id: a.id,
      name: a.name,
      deletedAt: a.deletedAt,
      imageCount: countMap.get(a.id) ?? 0,
      autoPurgeAt: a.deletedAt ? purgeAtOf(a.deletedAt) : null,
    })),
    images: deletedImages
      .filter(i => !deletedAlbumIds.has(i.albumId))
      .map(i => ({
        id: i.id,
        name: i.name,
        albumId: i.albumId,
        albumName: albumNames.get(i.albumId) ?? "未知相册",
        deletedAt: i.deletedAt,
        type: i.type,
        autoPurgeAt: i.deletedAt ? purgeAtOf(i.deletedAt) : null,
      })),
  });
}));

// 恢复相册：相册与其中的图片一并恢复
router.post("/albums/:id/restore", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const album = await findDeletedAlbum(String(req.params.id));
  await albumRepo().update({ id: album.id }, { deletedAt: null });
  await imageRepo().update({ albumId: album.id, deletedAt: Not(IsNull()) }, { deletedAt: null });
  res.json({ message: "相册已恢复" });
}));

// 恢复图片：所属相册必须在回收站外
router.post("/images/:id/restore", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const image = await findDeletedImage(String(req.params.id));

  const album = await albumRepo().findOne({ where: { id: image.albumId } });
  if (album?.deletedAt) {
    throw new HttpError(400, "所在相册也在回收站中，请先恢复相册");
  }

  await imageRepo().update({ id: image.id }, { deletedAt: null });
  res.json({ message: "图片已恢复" });
}));

// 彻底删除相册（连同其中的图片与物理文件）
router.delete("/albums/:id", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const album = await findDeletedAlbum(String(req.params.id));

  const images = await imageRepo().find({ where: { albumId: album.id } });
  await purgeImages(images);
  await albumRepo().delete(album.id);

  res.json({ message: "相册已彻底删除" });
}));

// 彻底删除单张图片
router.delete("/images/:id", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const image = await findDeletedImage(String(req.params.id));
  await purgeImages([image]);
  res.json({ message: "图片已彻底删除" });
}));

// 清空回收站
router.delete("/", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const deletedImages = await imageRepo().find({ where: { deletedAt: Not(IsNull()) } });
  await purgeImages(deletedImages);

  const deletedAlbums = await albumRepo().find({ where: { deletedAt: Not(IsNull()) } });
  if (deletedAlbums.length > 0) {
    await albumRepo().delete({ id: In(deletedAlbums.map(a => a.id)) });
  }

  res.json({ message: "回收站已清空" });
}));

export default router;

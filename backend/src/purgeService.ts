import fs from "fs";
import path from "path";
import { In, Not, IsNull } from "typeorm";
import { AppDataSource } from "./data-source";
import { Album } from "./entity/Album";
import { Image } from "./entity/Image";
import { SlideshowImage } from "./entity/SlideshowImage";
import { STORAGE_DIR, THUMBS_DIR } from "./storage";

const albumRepo = () => AppDataSource.getRepository(Album);
const imageRepo = () => AppDataSource.getRepository(Image);
const slideRepo = () => AppDataSource.getRepository(SlideshowImage);

// 视频封面帧（浏览器上传）可能的扩展名；与 images.ts 中 POST 写入时使用的映射保持一致
export const posterFilesOf = (filePath: string): string[] =>
  [".poster.webp", ".poster.jpg", ".poster.png"].map(suffix =>
    path.join(THUMBS_DIR, `${filePath}${suffix}`)
  );

// 彻底删除：数据行 + 轮播引用 + 物理文件与缩略图/封面帧（文件删除失败不影响结果，仅占用磁盘）。
// 若被删图片是某个相册的封面，顺延到该相册剩余第一张（或清空），避免封面悬空
export const purgeImages = async (images: Image[]) => {
  if (images.length === 0) return;
  const purgedIds = images.map(i => i.id);

  const albumsToFix = await albumRepo().find({ where: { coverImageId: In(purgedIds) } });
  if (albumsToFix.length > 0) {
    for (const album of albumsToFix) {
      const next = await imageRepo().findOne({
        where: { albumId: album.id, deletedAt: IsNull() },
        order: { createdAt: "ASC" },
      });
      album.coverImageId = next ? next.id : null;
    }
    await albumRepo().save(albumsToFix);
  }

  await slideRepo().delete({ imageId: In(purgedIds) });
  await imageRepo().delete({ id: In(purgedIds) });
  await Promise.all(images.map(img =>
    Promise.all([
      fs.promises.unlink(path.join(STORAGE_DIR, img.filePath)).catch(() => {}),
      fs.promises.unlink(path.join(THUMBS_DIR, `${img.filePath}.webp`)).catch(() => {}),
      ...posterFilesOf(img.filePath).map(p => fs.promises.unlink(p).catch(() => {})),
    ])
  ));
};

// 回收站保留天数：RECYCLE_RETENTION_DAYS，默认 30；设为 0 或负数关闭自动清理
export const getRetentionDays = (): number => {
  const raw = Number(process.env.RECYCLE_RETENTION_DAYS);
  if (!Number.isFinite(raw)) return 30;
  return Math.floor(raw);
};

export const isAutoPurgeEnabled = (): boolean => getRetentionDays() > 0;

export const autoPurgeAt = (deletedAt: Date): Date =>
  new Date(deletedAt.getTime() + getRetentionDays() * 24 * 60 * 60 * 1000);

// 删除回收站中超过保留期的条目：先过期相册（连同其中图片），再剩余的过期图片。
// 回收站条目量有限，直接取出全部软删除行在内存中按时间过滤，
// 避免 SQLite 日期存储格式差异导致比较失准。
export const purgeExpiredRecycleItems = async (): Promise<{ albums: number; images: number }> => {
  if (!isAutoPurgeEnabled()) return { albums: 0, images: 0 };

  const cutoff = new Date(Date.now() - getRetentionDays() * 24 * 60 * 60 * 1000);
  let albumCount = 0;
  let imageCount = 0;

  const deletedAlbums = await albumRepo().find({ where: { deletedAt: Not(IsNull()) } });
  const expiredAlbums = deletedAlbums.filter(a => a.deletedAt && a.deletedAt < cutoff);
  for (const album of expiredAlbums) {
    const images = await imageRepo().find({ where: { albumId: album.id } });
    await purgeImages(images);
    await albumRepo().delete(album.id);
    albumCount += 1;
    imageCount += images.length;
  }

  const deletedImages = await imageRepo().find({ where: { deletedAt: Not(IsNull()) } });
  const expiredImages = deletedImages.filter(i => i.deletedAt && i.deletedAt < cutoff);
  await purgeImages(expiredImages);
  imageCount += expiredImages.length;

  return { albums: albumCount, images: imageCount };
};

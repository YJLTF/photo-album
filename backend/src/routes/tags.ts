import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Tag } from "../entity/Tag";
import { ImageTag } from "../entity/ImageTag";
import { Image } from "../entity/Image";
import { authenticate, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../httpError";
import { In } from "typeorm";

const router = Router();

const tagRepo = () => AppDataSource.getRepository(Tag);
const imageTagRepo = () => AppDataSource.getRepository(ImageTag);
const imageRepo = () => AppDataSource.getRepository(Image);

const tagsForImageIds = async (imageIds: string[]): Promise<Record<string, Tag[]>> => {
  const map: Record<string, Tag[]> = {};
  if (imageIds.length === 0) return map;

  const links = await imageTagRepo().find({ where: { imageId: In(imageIds) } });
  const tagIds = [...new Set(links.map(l => l.tagId))];
  if (tagIds.length === 0) return map;

  const tags = await tagRepo().find({ where: { id: In(tagIds) } });
  const tagById = new Map(tags.map(t => [t.id, t]));
  for (const link of links) {
    const tag = tagById.get(link.tagId);
    if (tag) {
      (map[link.imageId] ||= []).push(tag);
    }
  }
  return map;
};

router.get("/", authenticate, asyncHandler(async (req, res) => {
  res.json(await tagRepo().find());
}));

// 全量 imageId -> 标签列表 的映射（标签筛选页一次拉齐，避免逐图请求）
router.get("/image-map", authenticate, asyncHandler(async (req, res) => {
  const images = await imageRepo().find({ select: ["id"] });
  res.json(await tagsForImageIds(images.map(i => i.id)));
}));

// 指定相册内 imageId -> 标签列表 的映射
router.get("/album/:albumId", authenticate, asyncHandler(async (req, res) => {
  const images = await imageRepo().find({
    where: { albumId: String(req.params.albumId) },
    select: ["id"],
  });
  res.json(await tagsForImageIds(images.map(i => i.id)));
}));

router.get("/image/:imageId", authenticate, asyncHandler(async (req, res) => {
  const map = await tagsForImageIds([String(req.params.imageId)]);
  res.json(map[String(req.params.imageId)] ?? []);
}));

router.post("/", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const { name, color } = req.body;

  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    throw new HttpError(400, "Tag name is required");
  }

  const existing = await tagRepo().findOne({ where: { name: trimmed } });
  if (existing) {
    throw new HttpError(409, "Tag already exists");
  }

  const tag = new Tag();
  tag.name = trimmed;
  tag.color = color || "#E8845C";

  await tagRepo().save(tag);
  res.status(201).json(tag);
}));

router.post("/image/:imageId", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const imageId = String(req.params.imageId);
  const { tagId } = req.body;

  if (!tagId) {
    throw new HttpError(400, "Tag ID is required");
  }

  const existing = await imageTagRepo().findOne({ where: { imageId, tagId } });
  if (existing) {
    throw new HttpError(409, "Tag already added to image");
  }

  const imageTag = new ImageTag();
  imageTag.imageId = imageId;
  imageTag.tagId = String(tagId);

  await imageTagRepo().save(imageTag);
  res.status(201).json(imageTag);
}));

router.delete("/:id", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);

  const tag = await tagRepo().findOne({ where: { id } });
  if (!tag) {
    throw new HttpError(404, "Tag not found");
  }

  await imageTagRepo().delete({ tagId: id });
  await tagRepo().delete(id);

  res.json({ message: "Tag deleted" });
}));

router.delete("/image/:imageId/:tagId", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const imageId = String(req.params.imageId);
  const tagId = String(req.params.tagId);

  const result = await imageTagRepo().delete({ imageId, tagId });
  if (result.affected === 0) {
    throw new HttpError(404, "Image tag not found");
  }

  res.json({ message: "Tag removed from image" });
}));

export default router;

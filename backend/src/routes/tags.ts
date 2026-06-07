import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Tag } from "../entity/Tag";
import { ImageTag } from "../entity/ImageTag";
import { authenticate, requirePermission } from "../middleware/auth";
import { PermissionLevel } from "../entity/AccessKey";
import { In } from "typeorm";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  const tags = await AppDataSource.getRepository(Tag).find();
  res.json(tags);
});

router.get("/image/:imageId", authenticate, async (req, res) => {
  const imageId = String(req.params.imageId);
  const imageTags = await AppDataSource.getRepository(ImageTag).find({ where: { imageId } });
  const tagIds = imageTags.map(it => it.tagId);
  
  if (tagIds.length === 0) {
    return res.json([]);
  }
  
  const tags = await AppDataSource.getRepository(Tag).find({ 
    where: { id: In(tagIds) }
  });
  res.json(tags);
});

router.post("/", authenticate, requirePermission("editor"), async (req, res) => {
  const { name, color } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Tag name is required" });
  }

  const existing = await AppDataSource.getRepository(Tag).findOne({ where: { name } });
  if (existing) {
    return res.status(409).json({ message: "Tag already exists" });
  }

  const tag = new Tag();
  tag.name = name;
  tag.color = color || "#E8845C";

  await AppDataSource.getRepository(Tag).save(tag);
  res.status(201).json(tag);
});

router.post("/image/:imageId", authenticate, requirePermission("editor"), async (req, res) => {
  const imageId = String(req.params.imageId);
  const { tagId } = req.body;

  if (!tagId) {
    return res.status(400).json({ message: "Tag ID is required" });
  }

  const existing = await AppDataSource.getRepository(ImageTag).findOne({ where: { imageId, tagId } });
  if (existing) {
    return res.status(409).json({ message: "Tag already added to image" });
  }

  const imageTag = new ImageTag();
  imageTag.imageId = imageId;
  imageTag.tagId = String(tagId);

  await AppDataSource.getRepository(ImageTag).save(imageTag);
  res.status(201).json(imageTag);
});

router.delete("/:id", authenticate, requirePermission("editor"), async (req, res) => {
  const id = String(req.params.id);

  const tag = await AppDataSource.getRepository(Tag).findOne({ where: { id } });
  if (!tag) {
    return res.status(404).json({ message: "Tag not found" });
  }

  // 首先显式删除所有关联的 ImageTag 记录
  await AppDataSource.getRepository(ImageTag).delete({ tagId: id });
  // 然后删除标签
  await AppDataSource.getRepository(Tag).delete(id);
  
  res.json({ message: "Tag deleted" });
});

router.delete("/image/:imageId/:tagId", authenticate, requirePermission("editor"), async (req, res) => {
  const imageId = String(req.params.imageId);
  const tagId = String(req.params.tagId);

  const result = await AppDataSource.getRepository(ImageTag).delete({ imageId, tagId });
  if (result.affected === 0) {
    return res.status(404).json({ message: "Image tag not found" });
  }

  res.json({ message: "Tag removed from image" });
});

export default router;
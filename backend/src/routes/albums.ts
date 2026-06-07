import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Album } from "../entity/Album";
import { Image } from "../entity/Image";
import { authenticate, requirePermission } from "../middleware/auth";
import { PermissionLevel } from "../entity/AccessKey";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  const albums = await AppDataSource.getRepository(Album).find({ order: { createdAt: "ASC" } });
  res.json(albums);
});

router.get("/:id", authenticate, async (req, res) => {
  const id = String(req.params.id);
  const album = await AppDataSource.getRepository(Album).findOne({ where: { id } });
  
  if (!album) {
    return res.status(404).json({ message: "Album not found" });
  }

  res.json(album);
});

router.post("/", authenticate, requirePermission("editor"), async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Album name is required" });
  }

  const album = new Album();
  album.name = name;

  await AppDataSource.getRepository(Album).save(album);
  res.status(201).json(album);
});

router.put("/:id", authenticate, requirePermission("editor"), async (req, res) => {
  const id = String(req.params.id);
  const { name, coverImageId } = req.body;

  const album = await AppDataSource.getRepository(Album).findOne({ where: { id } });
  if (!album) {
    return res.status(404).json({ message: "Album not found" });
  }

  if (name) album.name = name;
  if (coverImageId !== undefined) album.coverImageId = coverImageId;

  await AppDataSource.getRepository(Album).save(album);
  res.json(album);
});

router.delete("/:id", authenticate, requirePermission("editor"), async (req, res) => {
  const id = String(req.params.id);

  const album = await AppDataSource.getRepository(Album).findOne({ where: { id } });
  if (!album) {
    return res.status(404).json({ message: "Album not found" });
  }

  const images = await AppDataSource.getRepository(Image).find({ where: { albumId: id } });
  for (const image of images) {
    await AppDataSource.getRepository(Image).delete(image.id);
  }

  await AppDataSource.getRepository(Album).delete(id);
  res.json({ message: "Album deleted" });
});

export default router;
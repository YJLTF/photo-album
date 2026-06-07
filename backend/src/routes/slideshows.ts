import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Slideshow } from "../entity/Slideshow";
import { SlideshowImage } from "../entity/SlideshowImage";
import { authenticate, requirePermission } from "../middleware/auth";
import { PermissionLevel } from "../entity/AccessKey";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  const slideshows = await AppDataSource.getRepository(Slideshow).find({ order: { createdAt: "ASC" } });
  res.json(slideshows);
});

router.get("/:id", authenticate, async (req, res) => {
  const id = String(req.params.id);
  const slideshow = await AppDataSource.getRepository(Slideshow).findOne({ where: { id } });
  
  if (!slideshow) {
    return res.status(404).json({ message: "Slideshow not found" });
  }

  const images = await AppDataSource.getRepository(SlideshowImage)
    .find({ where: { slideshowId: id }, order: { order: "ASC" } });

  res.json({ ...slideshow, images });
});

router.post("/", authenticate, requirePermission("editor"), async (req, res) => {
  const { name, transitionEffect = "fade", interval = 3, autoPlay = true, images = [] } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Slideshow name is required" });
  }

  const slideshow = new Slideshow();
  slideshow.name = name;
  slideshow.transitionEffect = transitionEffect;
  slideshow.interval = interval;
  slideshow.autoPlay = autoPlay;

  await AppDataSource.getRepository(Slideshow).save(slideshow);

  for (let i = 0; i < images.length; i++) {
    const slide = new SlideshowImage();
    slide.slideshowId = slideshow.id;
    slide.imageId = images[i].imageId;
    slide.order = i;
    slide.overlayText = images[i].overlayText || "";
    slide.textPosition = images[i].textPosition || "bottom-center";
    slide.textColor = images[i].textColor || "#FFFFFF";
    slide.textSize = images[i].textSize || 16;
    await AppDataSource.getRepository(SlideshowImage).save(slide);
  }

  res.status(201).json(slideshow);
});

router.put("/:id", authenticate, requirePermission("editor"), async (req, res) => {
  const id = String(req.params.id);
  const { name, transitionEffect, interval, autoPlay, images } = req.body;

  const slideshow = await AppDataSource.getRepository(Slideshow).findOne({ where: { id } });
  if (!slideshow) {
    return res.status(404).json({ message: "Slideshow not found" });
  }

  if (name) slideshow.name = name;
  if (transitionEffect) slideshow.transitionEffect = transitionEffect;
  if (interval !== undefined) slideshow.interval = interval;
  if (autoPlay !== undefined) slideshow.autoPlay = autoPlay;

  await AppDataSource.getRepository(Slideshow).save(slideshow);

  if (images !== undefined) {
    await AppDataSource.getRepository(SlideshowImage).delete({ slideshowId: slideshow.id });
    for (let i = 0; i < images.length; i++) {
      const slide = new SlideshowImage();
      slide.slideshowId = slideshow.id;
      slide.imageId = images[i].imageId;
      slide.order = i;
      slide.overlayText = images[i].overlayText || "";
      slide.textPosition = images[i].textPosition || "bottom-center";
      slide.textColor = images[i].textColor || "#FFFFFF";
      slide.textSize = images[i].textSize || 16;
      await AppDataSource.getRepository(SlideshowImage).save(slide);
    }
  }

  res.json(slideshow);
});

router.delete("/:id", authenticate, requirePermission("editor"), async (req, res) => {
  const id = String(req.params.id);

  const slideshow = await AppDataSource.getRepository(Slideshow).findOne({ where: { id } });
  if (!slideshow) {
    return res.status(404).json({ message: "Slideshow not found" });
  }

  await AppDataSource.getRepository(SlideshowImage).delete({ slideshowId: slideshow.id });
  await AppDataSource.getRepository(Slideshow).delete(id);
  res.json({ message: "Slideshow deleted" });
});

export default router;
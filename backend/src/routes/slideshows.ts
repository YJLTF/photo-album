import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Slideshow, TransitionEffect } from "../entity/Slideshow";
import { SlideshowImage } from "../entity/SlideshowImage";
import { authenticate, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../httpError";

const router = Router();

const slideshowRepo = () => AppDataSource.getRepository(Slideshow);
const slideshowImageRepo = () => AppDataSource.getRepository(SlideshowImage);

const VALID_EFFECTS: TransitionEffect[] = ["fade", "slide", "zoom", "flip", "blur"];

// 客户端提交的轮播图片项（字段均可缺省，服务端统一补默认值）
interface SlideInput {
  imageId?: string;
  overlayText?: string;
  textPosition?: string;
  textColor?: string;
  textSize?: number;
}

// GROUP BY 一次查出每个轮播的图片数，避免 N+1
const getSlideCountMap = async (): Promise<Map<string, number>> => {
  const rows = await slideshowImageRepo()
    .createQueryBuilder("slide")
    .select("slide.slideshowId", "slideshowId")
    .addSelect("COUNT(*)", "cnt")
    .groupBy("slide.slideshowId")
    .getRawMany<{ slideshowId: string; cnt: string | number }>();
  return new Map(rows.map(r => [r.slideshowId, Number(r.cnt)]));
};

type NormalizedSlide = Omit<SlideshowImage, "id" | "slideshow">;

const normalizeSlideInput = (raw: SlideInput, order: number): NormalizedSlide => ({
  slideshowId: "",
  imageId: String(raw?.imageId ?? ""),
  order,
  overlayText: raw?.overlayText || "",
  textPosition: (raw?.textPosition || "bottom-center") as SlideshowImage["textPosition"],
  textColor: raw?.textColor || "#FFFFFF",
  textSize: Number(raw?.textSize) || 16,
});

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const [slideshows, countMap] = await Promise.all([
    slideshowRepo().find({ order: { createdAt: "ASC" } }),
    getSlideCountMap(),
  ]);
  res.json(slideshows.map(s => ({ ...s, imageCount: countMap.get(s.id) ?? 0 })));
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const slideshow = await slideshowRepo().findOne({ where: { id: String(req.params.id) } });
  if (!slideshow) {
    throw new HttpError(404, "Slideshow not found");
  }

  const images = await slideshowImageRepo()
    .find({ where: { slideshowId: slideshow.id }, order: { order: "ASC" } });

  res.json({ ...slideshow, images });
}));

router.post("/", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const { name, transitionEffect = "fade", interval = 3, autoPlay = true, images = [] } = req.body;

  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) {
    throw new HttpError(400, "Slideshow name is required");
  }
  if (!VALID_EFFECTS.includes(transitionEffect)) {
    throw new HttpError(400, "Invalid transition effect");
  }

  const slideshow = new Slideshow();
  slideshow.name = trimmedName;
  slideshow.transitionEffect = transitionEffect;
  slideshow.interval = Math.min(Math.max(Number(interval) || 3, 1), 60);
  slideshow.autoPlay = Boolean(autoPlay);

  await slideshowRepo().save(slideshow);

  if (Array.isArray(images) && images.length > 0) {
    await slideshowImageRepo().save(
      images.map((raw: SlideInput, i: number) => ({
        ...normalizeSlideInput(raw, i),
        slideshowId: slideshow.id,
      }))
    );
  }

  res.status(201).json(slideshow);
}));

router.put("/:id", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { name, transitionEffect, interval, autoPlay, images } = req.body;

  const slideshow = await slideshowRepo().findOne({ where: { id } });
  if (!slideshow) {
    throw new HttpError(404, "Slideshow not found");
  }

  if (typeof name === "string" && name.trim()) slideshow.name = name.trim();
  if (transitionEffect !== undefined) {
    if (!VALID_EFFECTS.includes(transitionEffect)) {
      throw new HttpError(400, "Invalid transition effect");
    }
    slideshow.transitionEffect = transitionEffect;
  }
  if (interval !== undefined) slideshow.interval = Math.min(Math.max(Number(interval) || 3, 1), 60);
  if (autoPlay !== undefined) slideshow.autoPlay = Boolean(autoPlay);

  await slideshowRepo().save(slideshow);

  if (images !== undefined) {
    await slideshowImageRepo().delete({ slideshowId: slideshow.id });
    if (Array.isArray(images) && images.length > 0) {
      await slideshowImageRepo().save(
        images.map((raw: SlideInput, i: number) => ({
          ...normalizeSlideInput(raw, i),
          slideshowId: slideshow.id,
        }))
      );
    }
  }

  res.json(slideshow);
}));

router.delete("/:id", authenticate, requirePermission("editor"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);

  const slideshow = await slideshowRepo().findOne({ where: { id } });
  if (!slideshow) {
    throw new HttpError(404, "Slideshow not found");
  }

  await slideshowImageRepo().delete({ slideshowId: slideshow.id });
  await slideshowRepo().delete(id);
  res.json({ message: "Slideshow deleted" });
}));

export default router;

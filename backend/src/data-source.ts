import "reflect-metadata";
import { DataSource } from "typeorm";
import { AccessKey } from "./entity/AccessKey";
import { Album } from "./entity/Album";
import { Image } from "./entity/Image";
import { Tag } from "./entity/Tag";
import { ImageTag } from "./entity/ImageTag";
import { Slideshow } from "./entity/Slideshow";
import { SlideshowImage } from "./entity/SlideshowImage";

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: process.env.DATABASE_PATH || "./data/photo-album.sqlite",
  entities: [AccessKey, Album, Image, Tag, ImageTag, Slideshow, SlideshowImage],
  synchronize: true,
  logging: false,
});
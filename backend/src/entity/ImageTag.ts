import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";
import { Image } from "./Image";
import { Tag } from "./Tag";

@Entity()
export class ImageTag {
  @PrimaryColumn()
  imageId: string;

  @PrimaryColumn()
  tagId: string;

  @ManyToOne(() => Image, image => image.imageTags, { onDelete: "CASCADE" })
  @JoinColumn({ name: "imageId" })
  image: Image;

  @ManyToOne(() => Tag, tag => tag.imageTags, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tagId" })
  tag: Tag;
}
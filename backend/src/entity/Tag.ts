import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { ImageTag } from "./ImageTag";

@Entity()
export class Tag {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  color: string;

  @OneToMany(() => ImageTag, imageTag => imageTag.tag, { cascade: true, onDelete: "CASCADE" })
  imageTags: ImageTag[];
}
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Album } from "./Album";
import { ImageTag } from "./ImageTag";

@Entity()
export class Image {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  albumId: string;

  @Column()
  name: string;

  @Column()
  filePath: string;

  @Column()
  fileSize: number;

  @Column()
  width: number;

  @Column()
  height: number;

  @Column()
  mimeType: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Album, album => album.images)
  @JoinColumn({ name: "albumId" })
  album: Album;

  @OneToMany(() => ImageTag, imageTag => imageTag.image, { cascade: true, onDelete: "CASCADE" })
  imageTags: ImageTag[];
}
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

  // 回收站：非 NULL 表示已软删除（恢复可还原，彻底删除时才清理物理文件）
  @Column({ type: "datetime", nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Album, album => album.images)
  @JoinColumn({ name: "albumId" })
  album: Album;

  @OneToMany(() => ImageTag, imageTag => imageTag.image, { cascade: true, onDelete: "CASCADE" })
  imageTags: ImageTag[];
}
import { Entity, Index, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Album } from "./Album";
import { ImageTag } from "./ImageTag";

@Entity()
// 相册内图片列表按 (albumId, deletedAt) 过滤最频繁；回收站清理/展示按 deletedAt 过滤
@Index(["albumId", "deletedAt"])
@Index(["deletedAt"])
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

  // 媒体类型：image 图片；video 视频（缩略图是上传时浏览器截取的封面帧，服务端无法用 sharp 生成）
  // 显式声明列类型：字符串字面量联合类型经反射为 Object，SQLite 无法推断
  @Column({ type: "varchar", default: "image" })
  type: "image" | "video";

  // 视频时长（秒），图片为 null
  @Column({ type: "float", nullable: true })
  duration: number | null;

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
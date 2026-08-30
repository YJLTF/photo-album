import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { Image } from "./Image";

@Entity()
export class Album {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  coverImageId: string;

  // 回收站：非 NULL 表示已软删除（相册删除时其中的图片一并软删除）
  @Column({ type: "datetime", nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Image, image => image.album)
  images: Image[];
}
import { Entity, Index, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Slideshow } from "./Slideshow";

export type TextPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

@Entity()
@Index(["slideshowId"])
export class SlideshowImage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  slideshowId: string;

  @Column()
  imageId: string;

  @Column()
  order: number;

  @Column({ nullable: true })
  overlayText: string;

  // 显式声明列类型：字符串字面量联合类型经反射为 Object，SQLite 无法推断
  @Column({ type: "varchar" })
  textPosition: TextPosition;

  @Column()
  textColor: string;

  @Column()
  textSize: number;

  @ManyToOne(() => Slideshow, slideshow => slideshow.slides)
  @JoinColumn({ name: "slideshowId" })
  slideshow: Slideshow;
}
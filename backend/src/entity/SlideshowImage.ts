import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
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

  @Column()
  textPosition: TextPosition;

  @Column()
  textColor: string;

  @Column()
  textSize: number;

  @ManyToOne(() => Slideshow, slideshow => slideshow.slides)
  @JoinColumn({ name: "slideshowId" })
  slideshow: Slideshow;
}
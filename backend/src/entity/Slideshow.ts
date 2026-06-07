import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { SlideshowImage } from "./SlideshowImage";

export type TransitionEffect = 'fade' | 'slide' | 'zoom' | 'flip' | 'blur';

@Entity()
export class Slideshow {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  transitionEffect: TransitionEffect;

  @Column()
  interval: number;

  @Column()
  autoPlay: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => SlideshowImage, image => image.slideshow)
  slides: SlideshowImage[];
}
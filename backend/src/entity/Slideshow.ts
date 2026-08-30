import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { SlideshowImage } from "./SlideshowImage";

export type TransitionEffect = 'fade' | 'slide' | 'zoom' | 'flip' | 'blur';

@Entity()
export class Slideshow {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  // 显式声明列类型：字符串字面量联合类型经反射为 Object，SQLite 无法推断
  @Column({ type: "varchar" })
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
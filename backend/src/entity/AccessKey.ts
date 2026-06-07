import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export type PermissionLevel = "viewer" | "editor" | "admin";

export const PermissionLevels: PermissionLevel[] = ["viewer", "editor", "admin"];

@Entity()
export class AccessKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  key: string;

  @Column({
    type: "varchar",
    length: 20,
    default: "viewer"
  })
  permission: PermissionLevel;

  @Column({ default: true })
  active: boolean;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
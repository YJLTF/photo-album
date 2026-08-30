import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export type PermissionLevel = "viewer" | "editor" | "admin";

export const PermissionLevels: PermissionLevel[] = ["viewer", "editor", "admin"];

@Entity()
export class AccessKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // 存储查找用 HMAC（登录/令牌校验按此等值匹配），不再存明文
  @Column({ unique: true })
  key: string;

  // 展示用 AES-256-GCM 密文，仅管理员列表解密显示；旧数据为 NULL（惰性迁移）
  @Column({ type: "text", nullable: true })
  keyEnc: string | null;

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
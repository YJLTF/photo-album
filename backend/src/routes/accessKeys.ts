import { Router } from "express";
import { AppDataSource } from "../data-source";
import { AccessKey, PermissionLevel } from "../entity/AccessKey";
import { authenticate, requirePermission, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, requirePermission("admin"), async (req, res) => {
  const keys = await AppDataSource.getRepository(AccessKey).find();
  res.json(keys);
});

router.post("/", authenticate, requirePermission("admin"), async (req, res) => {
  const { key, permission = "viewer" as PermissionLevel, description } = req.body;

  if (!key) {
    return res.status(400).json({ message: "Key is required" });
  }

  const existing = await AppDataSource.getRepository(AccessKey).findOne({ where: { key } });
  if (existing) {
    return res.status(409).json({ message: "Key already exists" });
  }

  const accessKey = new AccessKey();
  accessKey.key = key;
  accessKey.permission = permission;
  accessKey.description = description;
  accessKey.active = true;

  await AppDataSource.getRepository(AccessKey).save(accessKey);
  res.status(201).json(accessKey);
});

router.put("/:id", authenticate, requirePermission("admin"), async (req, res) => {
  const id = String(req.params.id);
  const { permission, description, active } = req.body;

  const accessKey = await AppDataSource.getRepository(AccessKey).findOne({ where: { id } });
  if (!accessKey) {
    return res.status(404).json({ message: "Access key not found" });
  }

  if (permission) accessKey.permission = permission;
  if (description !== undefined) accessKey.description = description;
  if (active !== undefined) accessKey.active = active;

  await AppDataSource.getRepository(AccessKey).save(accessKey);
  res.json(accessKey);
});

router.delete("/:id", authenticate, requirePermission("admin"), async (req, res) => {
  const { id } = req.params;

  const result = await AppDataSource.getRepository(AccessKey).delete(id);
  if (result.affected === 0) {
    return res.status(404).json({ message: "Access key not found" });
  }

  res.json({ message: "Access key deleted" });
});

// 修改密钥值（管理员可以修改任意密钥，其他用户只能修改自己的）
router.patch("/:id/key", authenticate, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { newKey } = req.body;

  const targetKey = await AppDataSource.getRepository(AccessKey).findOneBy({ id } as any);
  if (!targetKey) {
    return res.status(404).json({ message: "Access key not found" });
  }

  // 非管理员只能修改自己的密钥
  if (req.permission !== "admin" && req.accessKey?.key !== targetKey.key) {
    return res.status(403).json({ message: "Permission denied" });
  }

  if (!newKey || newKey.length < 6) {
    return res.status(400).json({ message: "新密钥至少需要6个字符" });
  }

  // 检查新密钥是否已存在
  const existing = await AppDataSource.getRepository(AccessKey).findOne({ where: { key: newKey } });
  if (existing && existing.id !== id) {
    return res.status(409).json({ message: "密钥已被使用" });
  }

  targetKey.key = newKey;
  await AppDataSource.getRepository(AccessKey).save(targetKey);
  res.json({ message: "密钥修改成功" });
});

export default router;
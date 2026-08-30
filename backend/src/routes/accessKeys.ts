import { Router } from "express";
import { AppDataSource } from "../data-source";
import { AccessKey, PermissionLevel, PermissionLevels } from "../entity/AccessKey";
import { authenticate, requirePermission, AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../httpError";

const router = Router();

const repo = () => AppDataSource.getRepository(AccessKey);

// 防止把系统里最后一个可用的管理员密钥删掉/禁用，导致无人能管理
const assertNotLastAdmin = async (target: AccessKey, nextActive?: boolean) => {
  const willRemainAdmin = target.permission === "admin" && nextActive !== false;
  if (!willRemainAdmin) return;

  const activeAdmins = await repo().count({ where: { permission: "admin", active: true } });
  if (activeAdmins <= 1) {
    throw new HttpError(400, "不能禁用或删除最后一个启用的管理员密钥");
  }
};

router.get("/", authenticate, requirePermission("admin"), asyncHandler(async (req, res) => {
  res.json(await repo().find());
}));

router.post("/", authenticate, requirePermission("admin"), asyncHandler(async (req, res) => {
  const { key, permission = "viewer" as PermissionLevel, description } = req.body;

  if (!key || String(key).length < 6) {
    throw new HttpError(400, "密钥至少需要6个字符");
  }
  if (!PermissionLevels.includes(permission)) {
    throw new HttpError(400, "Invalid permission level");
  }

  const existing = await repo().findOne({ where: { key } });
  if (existing) {
    throw new HttpError(409, "Key already exists");
  }

  const accessKey = new AccessKey();
  accessKey.key = key;
  accessKey.permission = permission;
  accessKey.description = description;
  accessKey.active = true;

  await repo().save(accessKey);
  res.status(201).json(accessKey);
}));

router.put("/:id", authenticate, requirePermission("admin"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { permission, description, active } = req.body;

  const accessKey = await repo().findOne({ where: { id } });
  if (!accessKey) {
    throw new HttpError(404, "Access key not found");
  }

  if (permission !== undefined) {
    if (!PermissionLevels.includes(permission)) {
      throw new HttpError(400, "Invalid permission level");
    }
    // 降权前确认不是最后一个管理员
    await assertNotLastAdmin(accessKey, permission === "admin" ? accessKey.active : false);
    accessKey.permission = permission;
  }
  if (active !== undefined) {
    await assertNotLastAdmin(accessKey, active);
    accessKey.active = active;
  }
  if (description !== undefined) accessKey.description = description;

  await repo().save(accessKey);
  res.json(accessKey);
}));

router.delete("/:id", authenticate, requirePermission("admin"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);

  const target = await repo().findOne({ where: { id } });
  if (!target) {
    throw new HttpError(404, "Access key not found");
  }

  await assertNotLastAdmin(target, false);

  await repo().delete(id);
  res.json({ message: "Access key deleted" });
}));

// 修改密钥值（管理员可以修改任意密钥，其他用户只能修改自己的）
router.patch("/:id/key", authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id);
  const { newKey } = req.body;

  const targetKey = await repo().findOne({ where: { id } });
  if (!targetKey) {
    throw new HttpError(404, "Access key not found");
  }

  // 非管理员只能修改自己的密钥
  if (req.permission !== "admin" && req.accessKey?.key !== targetKey.key) {
    throw new HttpError(403, "Permission denied");
  }

  if (!newKey || String(newKey).length < 6) {
    throw new HttpError(400, "新密钥至少需要6个字符");
  }

  const existing = await repo().findOne({ where: { key: newKey } });
  if (existing && existing.id !== id) {
    throw new HttpError(409, "密钥已被使用");
  }

  targetKey.key = newKey;
  await repo().save(targetKey);
  res.json({ message: "密钥修改成功" });
}));

export default router;

import { Router } from "express";
import { Not } from "typeorm";
import { AppDataSource } from "../data-source";
import { AccessKey, PermissionLevel, PermissionLevels } from "../entity/AccessKey";
import { authenticate, requirePermission, AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../httpError";
import { lookupHash, encryptKey, decryptKey } from "../keyCrypto";

const router = Router();

const repo = () => AppDataSource.getRepository(AccessKey);

// 查重时同时匹配 HMAC 与历史明文，避免新旧存储混用期间产生重复密钥
const findKeyByPlain = (plainKey: string) =>
  repo().findOne({ where: [{ key: lookupHash(plainKey) }, { key: plainKey }] });

// 防止把系统里最后一个可用的管理员密钥删掉/禁用/降级，导致无人能管理。
// 只有当该密钥当前是"启用的管理员"、且变更后将不再是时才需要检查。
const assertNotLastAdmin = async (
  target: AccessKey,
  next: { permission?: PermissionLevel; active?: boolean }
) => {
  if (target.permission !== "admin" || !target.active) return;

  const nextPermission = next.permission ?? target.permission;
  const nextActive = next.active ?? target.active;
  if (nextPermission === "admin" && nextActive) return;

  const otherActiveAdmins = await repo().count({
    where: { permission: "admin", active: true, id: Not(target.id) },
  });
  if (otherActiveAdmins === 0) {
    throw new HttpError(400, "不能禁用、删除或降级最后一个启用的管理员密钥");
  }
};

// 管理员列表返回可读密钥（历史明文行原样返回，新数据解密显示）；keyEnc 密文不出网
router.get("/", authenticate, requirePermission("admin"), asyncHandler(async (req, res) => {
  const keys = await repo().find();
  res.json(keys.map(({ keyEnc, ...k }) => ({ ...k, key: decryptKey(keyEnc) || k.key })));
}));

router.post("/", authenticate, requirePermission("admin"), asyncHandler(async (req, res) => {
  const { key, permission = "viewer" as PermissionLevel, description } = req.body;

  if (!key || String(key).length < 6) {
    throw new HttpError(400, "密钥至少需要6个字符");
  }
  if (!PermissionLevels.includes(permission)) {
    throw new HttpError(400, "Invalid permission level");
  }

  const existing = await findKeyByPlain(String(key));
  if (existing) {
    throw new HttpError(409, "Key already exists");
  }

  const accessKey = new AccessKey();
  accessKey.key = lookupHash(String(key));
  accessKey.keyEnc = encryptKey(String(key));
  accessKey.permission = permission;
  accessKey.description = description;
  accessKey.active = true;

  await repo().save(accessKey);
  const { keyEnc: _keyEnc, ...created } = accessKey;
  res.status(201).json({ ...created, key: String(key) });
}));

router.put("/:id", authenticate, requirePermission("admin"), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { permission, description, active } = req.body;

  const accessKey = await repo().findOne({ where: { id } });
  if (!accessKey) {
    throw new HttpError(404, "Access key not found");
  }

  if (permission !== undefined && !PermissionLevels.includes(permission)) {
    throw new HttpError(400, "Invalid permission level");
  }

  // 降级 / 禁用前确认不是最后一个管理员（值校验通过后再做保护检查）
  if (permission !== undefined || active !== undefined) {
    await assertNotLastAdmin(accessKey, { permission, active });
  }

  if (permission !== undefined) accessKey.permission = permission;
  if (active !== undefined) accessKey.active = active;
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

  await assertNotLastAdmin(target, { active: false });

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

  const existing = await findKeyByPlain(String(newKey));
  if (existing && existing.id !== id) {
    throw new HttpError(409, "密钥已被使用");
  }

  targetKey.key = lookupHash(String(newKey));
  targetKey.keyEnc = encryptKey(String(newKey));
  await repo().save(targetKey);
  res.json({ message: "密钥修改成功" });
}));

export default router;

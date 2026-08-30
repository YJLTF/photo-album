import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { AccessKey } from "../entity/AccessKey";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../httpError";
import { lookupHash, encryptKey } from "../keyCrypto";

// 媒体令牌有效期（秒）：仅够 <img> 加载图片，即便随 URL 泄露价值也有限
const MEDIA_TOKEN_TTL_SECONDS = 600;

const router = Router();

// 登录接口简易限流：同一 IP 每个时间窗口内最多失败若干次，防止密钥被暴力尝试
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map<string, { count: number; resetAt: number }>();

const loginRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = loginFailures.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= LOGIN_MAX_FAILURES) {
      res.status(429).json({ message: "尝试过于频繁，请稍后再试" });
      return;
    }
  } else {
    loginFailures.set(ip, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
  }
  next();
};

const recordLoginFailure = (req: Request) => {
  const entry = loginFailures.get(req.ip || "unknown");
  if (entry) entry.count++;
};

const clearLoginFailures = (req: Request) => {
  loginFailures.delete(req.ip || "unknown");
};

// 按明文密钥查找：优先 HMAC（新版存储）；未命中再试明文（历史数据），命中即惰性迁移为加密存储
const findActiveKey = async (plainKey: string): Promise<AccessKey | null> => {
  const repo = AppDataSource.getRepository(AccessKey);
  const byHash = await repo.findOne({ where: { key: lookupHash(plainKey), active: true } });
  if (byHash) return byHash;

  const legacy = await repo.findOne({ where: { key: plainKey, active: true } });
  if (legacy) {
    legacy.key = lookupHash(plainKey);
    legacy.keyEnc = encryptKey(plainKey);
    await repo.save(legacy);
  }
  return legacy;
};

router.post("/login", loginRateLimiter, asyncHandler(async (req, res) => {
  const { key } = req.body;

  if (!key) {
    throw new HttpError(400, "Access key is required");
  }

  const accessKey = await findActiveKey(key);

  if (!accessKey) {
    recordLoginFailure(req);
    throw new HttpError(401, "Invalid access key");
  }

  clearLoginFailures(req);

  // payload 携带 HMAC（key）与密钥 ID（kid）：不含明文，且便于前端判断"改的是不是自己的密钥"
  const token = jwt.sign({ key: accessKey.key, kid: accessKey.id }, process.env.JWT_SECRET!, { expiresIn: "24h" });

  res.json({
    token,
    permission: accessKey.permission,
    description: accessKey.description
  });
}));

// 签发短期媒体令牌：图片 URL 用它代替完整 JWT，避免完整令牌进入访问日志 / 浏览器历史
router.post("/media-token", authenticate, asyncHandler(async (req, res) => {
  const token = jwt.sign({ media: true }, process.env.JWT_SECRET!, {
    expiresIn: MEDIA_TOKEN_TTL_SECONDS,
  });
  res.json({ token, expiresIn: MEDIA_TOKEN_TTL_SECONDS });
}));

router.post("/validate", asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "No token provided");
  }

  const token = authHeader.slice(7);

  let decoded: { key: string };
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!) as { key: string };
  } catch {
    throw new HttpError(401, "Invalid token");
  }

  const accessKey = await AppDataSource.getRepository(AccessKey).findOne({
    where: { key: decoded.key, active: true }
  });

  if (!accessKey) {
    throw new HttpError(401, "Invalid key");
  }

  res.json({
    valid: true,
    permission: accessKey.permission,
    description: accessKey.description
  });
}));

export default router;

import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { AccessKey } from "../entity/AccessKey";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../httpError";

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

router.post("/login", loginRateLimiter, asyncHandler(async (req, res) => {
  const { key } = req.body;

  if (!key) {
    throw new HttpError(400, "Access key is required");
  }

  const accessKey = await AppDataSource.getRepository(AccessKey).findOne({
    where: { key, active: true }
  });

  if (!accessKey) {
    recordLoginFailure(req);
    throw new HttpError(401, "Invalid access key");
  }

  clearLoginFailures(req);

  const token = jwt.sign({ key: accessKey.key }, process.env.JWT_SECRET!, { expiresIn: "24h" });

  res.json({
    token,
    permission: accessKey.permission,
    description: accessKey.description
  });
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

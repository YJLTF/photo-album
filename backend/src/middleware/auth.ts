import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { AccessKey, PermissionLevel } from "../entity/AccessKey";

export interface AuthenticatedRequest extends Request {
  accessKey?: AccessKey;
  permission?: PermissionLevel;
}

const extractToken = (req: Request): string => {
  // 优先从请求头获取 token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // 如果请求头没有，尝试从 URL 参数获取（用于 <img> 等无法带 Header 的请求）
  if (req.query.token) {
    return String(req.query.token);
  }
  return "";
};

// 完整访问令牌：携带 key，需要回库校验密钥仍然有效。
// 导出供 /auth/validate 等自行解析令牌的路由复用，避免遗漏"媒体令牌不可当 API 令牌"的校验。
export const verifyAccessToken = (token: string): { key: string; kid?: string } => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { key?: string; media?: boolean };
  // 媒体令牌没有 key，绝不允许当作 API 访问令牌使用
  if (decoded.media === true || !decoded.key) {
    throw new Error("media token cannot be used for API access");
  }
  return { key: decoded.key };
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { key } = verifyAccessToken(token);
    const accessKey = await AppDataSource.getRepository(AccessKey).findOne({
      where: { key, active: true }
    });

    if (!accessKey) {
      return res.status(401).json({ message: "Invalid or expired key" });
    }

    (req as AuthenticatedRequest).accessKey = accessKey;
    (req as AuthenticatedRequest).permission = accessKey.permission;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// 媒体路由（图片文件 / 缩略图）专用：接受完整访问令牌，也接受短期媒体令牌。
// 媒体令牌有效期只有几分钟，即使随 URL 进入访问日志/浏览器历史，泄露价值也很有限。
export const authenticateMedia = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { key?: string; media?: boolean };

    if (decoded.media === true) {
      // 短期媒体令牌：签发时已通过完整认证，无需回库校验
      return next();
    }

    if (!decoded.key) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const accessKey = await AppDataSource.getRepository(AccessKey).findOne({
      where: { key: decoded.key, active: true }
    });
    if (!accessKey) {
      return res.status(401).json({ message: "Invalid or expired key" });
    }

    (req as AuthenticatedRequest).accessKey = accessKey;
    (req as AuthenticatedRequest).permission = accessKey.permission;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requirePermission = (requiredPermission: PermissionLevel) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const permission = (req as AuthenticatedRequest).permission;

    const permissionOrder: Record<PermissionLevel, number> = {
      viewer: 1,
      editor: 2,
      admin: 3
    };

    // 未知权限值按最低权限处理，避免 undefined 比较导致绕过校验
    const level = permission ? permissionOrder[permission] ?? 0 : 0;

    if (level < permissionOrder[requiredPermission]) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

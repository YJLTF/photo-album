import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { AccessKey, PermissionLevel } from "../entity/AccessKey";

export interface AuthenticatedRequest extends Request {
  accessKey?: AccessKey;
  permission?: PermissionLevel;
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  let token = "";
  
  // 优先从请求头获取 token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  
  // 如果请求头没有，尝试从 URL 参数获取（用于图片请求）
  if (!token && req.query.token) {
    token = String(req.query.token);
  }
  
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { key: string };
    const accessKey = await AppDataSource.getRepository(AccessKey).findOne({
      where: { key: decoded.key, active: true }
    });

    if (!accessKey) {
      return res.status(401).json({ message: "Invalid or expired key" });
    }

    (req as AuthenticatedRequest).accessKey = accessKey;
    (req as AuthenticatedRequest).permission = accessKey.permission;
    next();
  } catch (error) {
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
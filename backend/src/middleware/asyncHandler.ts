import { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Express 4 不会捕获 async handler 内抛出的异常（会变成 unhandled rejection 直接打崩进程），
// 统一用该包装器把 Promise 异常转给全局错误中间件
export const asyncHandler =
  (fn: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

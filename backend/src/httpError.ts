// 供业务代码抛出带状态码的业务错误（如上传文件类型不允许），由全局错误中间件统一转换成响应
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

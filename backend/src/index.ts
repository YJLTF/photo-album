import "reflect-metadata";
// dotenv 必须在其余模块 import 之前加载：data-source / storage 在模块加载阶段就读取 env，
// 写在下面的 dotenv.config() 会因 import 提升而晚于它们执行，导致 DATABASE_PATH / UPLOAD_DIR 失效
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { MulterError } from "multer";
import { HttpError } from "./httpError";
import { AppDataSource } from "./data-source";
import { AccessKey } from "./entity/AccessKey";
import { lookupHash, encryptKey } from "./keyCrypto";
import authRoutes from "./routes/auth";
import accessKeyRoutes from "./routes/accessKeys";
import albumRoutes from "./routes/albums";
import imageRoutes from "./routes/images";
import tagRoutes from "./routes/tags";
import slideshowRoutes from "./routes/slideshows";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/access-keys", accessKeyRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/slideshows", slideshowRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 未匹配到的 /api 路径返回 404 JSON，而不是落入 SPA 回退返回 index.html
app.use("/api", (req, res) => {
  res.status(404).json({ message: "Not found" });
});

// 静态文件服务（前端构建产物）
const publicPath = path.join(__dirname, "../public");
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));

  // 处理 SPA 路由回退（仅非 /api 路径）
  app.get("*", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
}

// 全局错误中间件：兜住所有未被捕获的同步/异步异常，避免进程崩溃
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof MulterError) {
    return res.status(400).json({ message: `上传失败: ${err.message}` });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error("Unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ message: "Internal server error" });
});

const initialize = async () => {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set. Add it to backend/.env (or environment) before starting.");
    process.exit(1);
  }

  try {
    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data", { recursive: true });
    }
    await AppDataSource.initialize();
    console.log("Database connected");

    // 首次启动时创建默认管理员密钥（与其他密钥一样加密存储）
    const keyCount = await AppDataSource.getRepository(AccessKey).count();
    if (keyCount === 0) {
      const defaultKey = new AccessKey();
      defaultKey.key = lookupHash("admin123");
      defaultKey.keyEnc = encryptKey("admin123");
      defaultKey.permission = "admin";
      defaultKey.description = "默认管理员密钥";
      defaultKey.active = true;
      await AppDataSource.getRepository(AccessKey).save(defaultKey);
      console.log("Default admin key created: admin123");
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
};

initialize();

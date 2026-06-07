import "reflect-metadata";
import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";

dotenv.config();
import { AppDataSource } from "./data-source";
import { AccessKey } from "./entity/AccessKey";
import authRoutes from "./routes/auth";
import accessKeyRoutes from "./routes/accessKeys";
import albumRoutes from "./routes/albums";
import imageRoutes from "./routes/images";
import tagRoutes from "./routes/tags";
import slideshowRoutes from "./routes/slideshows";
import fs from "fs";

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

// 静态文件服务（前端构建产物）
const publicPath = path.join(__dirname, "../public");
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  
  // 处理 SPA 路由回退
  app.get("*", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
}

const initialize = async () => {
  try {
    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data", { recursive: true });
    }
    if (!fs.existsSync("./uploads")) {
      fs.mkdirSync("./uploads", { recursive: true });
    }
    await AppDataSource.initialize();
    console.log("Database connected");
    
    // 首次启动时创建默认管理员密钥
    const keyCount = await AppDataSource.getRepository(AccessKey).count();
    if (keyCount === 0) {
      const defaultKey = new AccessKey();
      defaultKey.key = "admin123";
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
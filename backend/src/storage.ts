import fs from "fs";
import path from "path";

// 上传文件的存储目录，供 images / albums 路由共享（删除相册时也要清理物理文件）
export const STORAGE_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

// 网格缩略图缓存目录（与原图同一数据卷，重建容器不丢失）
export const THUMBS_DIR = path.join(STORAGE_DIR, "thumbs");

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

if (!fs.existsSync(THUMBS_DIR)) {
  fs.mkdirSync(THUMBS_DIR, { recursive: true });
}

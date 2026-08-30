import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import path from "path";

// 必须在动态 import 业务模块之前设置：data-source / keyCrypto / storage
// 在模块加载阶段就读取这些 env
process.env.JWT_SECRET = "test-secret-for-vitest";
process.env.DATABASE_PATH = ":memory:";
process.env.UPLOAD_DIR = path.join(process.cwd(), ".tmp-test-uploads");

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

describe("API 回归", () => {
  let app: express.Express;
  let adminAToken: string;
  let adminAId: string;
  let adminBToken: string;

  beforeAll(async () => {
    const { AppDataSource } = await import("../src/data-source");
    await AppDataSource.initialize();

    const { AccessKey } = await import("../src/entity/AccessKey");
    const { lookupHash, encryptKey } = await import("../src/keyCrypto");

    const { default: authRoutes } = await import("../src/routes/auth");
    const { default: accessKeyRoutes } = await import("../src/routes/accessKeys");
    const { default: albumRoutes } = await import("../src/routes/albums");
    const { default: imageRoutes } = await import("../src/routes/images");

    app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);
    app.use("/api/access-keys", accessKeyRoutes);
    app.use("/api/albums", albumRoutes);
    app.use("/api/images", imageRoutes);
    // 与 index.ts 一致的全局错误兜底（测试只需状态码 + message）
    app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.status ?? 500).json({ message: err.message || "error" });
    });

    // 种子数据：仅一个启用的管理员密钥
    const repo = AppDataSource.getRepository(AccessKey);
    const admin = await repo.save({
      key: lookupHash("admin-key-aaaa"),
      keyEnc: encryptKey("admin-key-aaaa"),
      permission: "admin",
      active: true,
      description: "种子管理员",
    });
    adminAId = admin.id;

    const login = await request(app).post("/api/auth/login").send({ key: "admin-key-aaaa" });
    expect(login.status).toBe(200);
    adminAToken = login.body.token;
  });

  it("不能删除/禁用/降级最后一个启用的管理员", async () => {
    const del = await request(app)
      .delete(`/api/access-keys/${adminAId}`)
      .set("Authorization", `Bearer ${adminAToken}`);
    expect(del.status).toBe(400);

    const disable = await request(app)
      .put(`/api/access-keys/${adminAId}`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ active: false });
    expect(disable.status).toBe(400);

    const downgrade = await request(app)
      .put(`/api/access-keys/${adminAId}`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ permission: "viewer" });
    expect(downgrade.status).toBe(400);
  });

  it("最后一个管理员仍可编辑描述、重复保存权限、启用自己", async () => {
    const desc = await request(app)
      .put(`/api/access-keys/${adminAId}`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ description: "改个描述" });
    expect(desc.status).toBe(200);

    const noop = await request(app)
      .put(`/api/access-keys/${adminAId}`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ permission: "admin", active: true });
    expect(noop.status).toBe(200);
  });

  it("存在第二个管理员后，可删除/禁用其中一个", async () => {
    const created = await request(app)
      .post("/api/access-keys")
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ key: "admin-key-bbbb", permission: "admin", description: "第二管理员" });
    expect(created.status).toBe(201);

    const del = await request(app)
      .delete(`/api/access-keys/${adminAId}`)
      .set("Authorization", `Bearer ${adminAToken}`);
    expect(del.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send({ key: "admin-key-bbbb" });
    expect(login.status).toBe(200);
    adminBToken = login.body.token;
  });

  it("/auth/validate 拒绝媒体令牌，接受完整令牌", async () => {
    const media = await request(app)
      .post("/api/auth/media-token")
      .set("Authorization", `Bearer ${adminBToken}`);
    expect(media.status).toBe(200);

    const rejected = await request(app).post("/api/auth/validate")
      .set("Authorization", `Bearer ${media.body.token}`);
    expect(rejected.status).toBe(401);

    const ok = await request(app).post("/api/auth/validate")
      .set("Authorization", `Bearer ${adminBToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.valid).toBe(true);
  });

  it("自动封面：计数排除回收站中的图片（清空相册后重新上传仍会自动设封面）", async () => {
    const { AppDataSource } = await import("../src/data-source");
    const { Album } = await import("../src/entity/Album");
    const { Image } = await import("../src/entity/Image");

    const album = await AppDataSource.getRepository(Album).save({ name: "封面回归相册" });

    // 预置一张已在回收站中的历史图片（模拟"删光相册后重新上传"的场景）
    await AppDataSource.getRepository(Image).save({
      albumId: album.id,
      name: "recycled.png",
      filePath: "recycled-does-not-exist.png",
      fileSize: 1,
      width: 1,
      height: 1,
      mimeType: "image/png",
      type: "image",
      duration: null,
      deletedAt: new Date(),
    });

    const up = await request(app)
      .post("/api/images")
      .set("Authorization", `Bearer ${adminBToken}`)
      .field("albumId", album.id)
      .attach("image", PNG_1PX, { filename: "new.png", contentType: "image/png" });
    expect(up.status).toBe(201);

    const fetched = await request(app)
      .get(`/api/albums/${album.id}`)
      .set("Authorization", `Bearer ${adminBToken}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.coverImageId).toBe(up.body.id);
  });

  it("软删除图片时服务端顺延封面，删空后清空封面", async () => {
    const album = await request(app)
      .post("/api/albums")
      .set("Authorization", `Bearer ${adminBToken}`)
      .send({ name: "封面顺延相册" });
    expect(album.status).toBe(201);

    const first = await request(app)
      .post("/api/images")
      .set("Authorization", `Bearer ${adminBToken}`)
      .field("albumId", album.body.id)
      .attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" });
    const second = await request(app)
      .post("/api/images")
      .set("Authorization", `Bearer ${adminBToken}`)
      .field("albumId", album.body.id)
      .attach("image", PNG_1PX, { filename: "b.png", contentType: "image/png" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    // 首张自动成为封面
    let fetched = await request(app)
      .get(`/api/albums/${album.body.id}`)
      .set("Authorization", `Bearer ${adminBToken}`);
    expect(fetched.body.coverImageId).toBe(first.body.id);

    // 删除封面图：服务端顺延到剩余第一张
    await request(app)
      .delete(`/api/images/${first.body.id}`)
      .set("Authorization", `Bearer ${adminBToken}`);
    fetched = await request(app)
      .get(`/api/albums/${album.body.id}`)
      .set("Authorization", `Bearer ${adminBToken}`);
    expect(fetched.body.coverImageId).toBe(second.body.id);

    // 删除最后一张：封面清空
    await request(app)
      .delete(`/api/images/${second.body.id}`)
      .set("Authorization", `Bearer ${adminBToken}`);
    fetched = await request(app)
      .get(`/api/albums/${album.body.id}`)
      .set("Authorization", `Bearer ${adminBToken}`);
    expect(fetched.body.coverImageId).toBeNull();
  });
});

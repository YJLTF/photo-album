import crypto from "crypto";

// 访问密钥的两段式存储：
//   key    列 = HMAC-SHA256(明文)，用于登录/令牌校验的等值查找（确定性，无法反查明文）
//   keyEnc 列 = AES-256-GCM(明文)，仅供管理员界面展示/复制时解密
// 这样 SQLite 文件单独泄露时拿不到密钥明文，而 JWT_SECRET（或独立的 KEY_SECRET）仍可解密。
// 注意：更换派生密钥会使既有密钥无法匹配/解密，需重置访问密钥。

const derivedSecret = () =>
  process.env.KEY_SECRET || process.env.JWT_SECRET || "";

const lookupKeyCache: { secret: string; key: Buffer } = { secret: "", key: Buffer.alloc(0) };
const hmacKey = (): Buffer => {
  const secret = derivedSecret();
  if (lookupKeyCache.secret !== secret || lookupKeyCache.key.length === 0) {
    lookupKeyCache.secret = secret;
    lookupKeyCache.key = crypto.createHash("sha256").update(`${secret}:key-lookup`).digest();
  }
  return lookupKeyCache.key;
};

const encKey = (): Buffer =>
  crypto.createHash("sha256").update(`${derivedSecret()}:key-encryption`).digest();

// 查找用 HMAC（确定性）
export const lookupHash = (plainKey: string): string =>
  crypto.createHmac("sha256", hmacKey()).update(plainKey, "utf8").digest("hex");

// 展示用加密（随机 IV，每次结果不同）
export const encryptKey = (plainKey: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plainKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${enc.toString("base64")}:${tag.toString("base64")}`;
};

// 解密失败（如派生密钥已轮换）时返回占位符，保证管理页不崩
export const decryptKey = (stored: string | null | undefined): string => {
  if (!stored || !stored.startsWith("enc:v1:")) return stored ?? "";
  try {
    const [, , ivB64, dataB64, tagB64] = stored.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "••••（无法解密，密钥派生密钥可能已更换）";
  }
};

// 是否已是加密存储（用于旧数据的惰性迁移判断）
export const isEncrypted = (stored: string | null | undefined): boolean =>
  Boolean(stored && stored.startsWith("enc:v1:"));

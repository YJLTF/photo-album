import { extractVideoMeta } from "@/lib/videoPoster";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// —— 媒体令牌：短期签名，仅用于图片 URL，避免完整 JWT 进入访问日志 / 浏览器历史 ——
// 未取到（或刚好过期）时回退完整 token，保证首屏图片仍能加载
let mediaToken: string | null = null;
let mediaTokenExpireAt = 0;
let mediaTokenTimer: number | null = null;

export const ensureMediaToken = async (): Promise<void> => {
  // 距过期不足 1 分钟时提前续期
  if (mediaToken && Date.now() < mediaTokenExpireAt - 60_000) return;
  try {
    const res = await request<{ token: string; expiresIn: number }>("/auth/media-token", {
      method: "POST",
    });
    mediaToken = res.token;
    mediaTokenExpireAt = Date.now() + res.expiresIn * 1000;
    if (mediaTokenTimer) clearTimeout(mediaTokenTimer);
    mediaTokenTimer = window.setTimeout(() => {
      void ensureMediaToken();
    }, Math.max(res.expiresIn - 60, 30) * 1000);
  } catch {
    mediaToken = null;
    mediaTokenExpireAt = 0;
  }
};

const tokenQuery = () => {
  if (mediaToken && Date.now() < mediaTokenExpireAt) {
    return `?token=${encodeURIComponent(mediaToken)}`;
  }
  const token = localStorage.getItem("token");
  return token ? `?token=${encodeURIComponent(token)}` : "";
};

export const getImageUrlWithAuth = (imageId: string): string =>
  `${API_BASE}/images/${imageId}${tokenQuery()}`;

// 网格/封面等小图用缩略图（服务端按需生成，体积约为原图的 1%）
export const getThumbnailUrlWithAuth = (imageId: string): string =>
  `${API_BASE}/images/${imageId}/thumbnail${tokenQuery()}`;

export interface LoginResponse {
  token: string;
  permission: PermissionLevel;
  description?: string;
}

export type PermissionLevel = "viewer" | "editor" | "admin";

const getToken = () => localStorage.getItem("token");

// 登录态失效时统一清理并回登录页，避免各页面各自报错
const handleUnauthorized = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("permission");
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
};

const request = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers as Record<string, string>),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
    });
  } catch {
    // fetch 本身抛错说明请求没到服务器（断网/服务不可达），与密码错误等业务错误区分开
    throw new Error("无法连接服务器，请检查网络后重试");
  }

  if (response.status === 401 && !url.startsWith("/auth/login")) {
    handleUnauthorized();
    throw new Error("登录已过期，请重新登录");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "" }));
    const err = new Error(error.message || `请求失败（HTTP ${response.status}）`) as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  return response.json();
};

export const authApi = {
  login: (key: string): Promise<LoginResponse> =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ key }),
    }),

  validate: (): Promise<{ valid: boolean; permission: PermissionLevel; description?: string }> =>
    request("/auth/validate", {
      method: "POST",
    }),
};

export const albumApi = {
  getAll: (): Promise<Album[]> => request("/albums"),

  getById: (id: string): Promise<Album> => request(`/albums/${id}`),

  create: (name: string): Promise<Album> =>
    request("/albums", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  update: (id: string, data: { name?: string; coverImageId?: string | null }): Promise<Album> =>
    request(`/albums/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<{ message: string }> =>
    request(`/albums/${id}`, {
      method: "DELETE",
    }),
};

export const imageApi = {
  // 分页可选：传 page+limit 返回一页；不传则一次拉全量（标签页、预览页需要完整列表）
  getByAlbum: (albumId: string, page?: number, limit?: number): Promise<Paged<ImageItem>> => {
    const query = page && limit ? `?page=${page}&limit=${limit}` : "";
    return request(`/images/album/${albumId}${query}`);
  },

  getAll: (): Promise<Paged<ImageItem>> => request("/images"),

  getRecent: (limit = 8): Promise<ImageItem[]> => request(`/images/recent?limit=${limit}`),

  getMeta: (id: string): Promise<ImageItem> => request(`/images/${id}/meta`),

  getById: (id: string): Promise<Blob> => {
    const token = getToken();
    return fetch(`${API_BASE}/images/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(res => {
      if (!res.ok) throw new Error("Image not found");
      return res.blob();
    });
  },

  // 预取原图进浏览器私有缓存（服务端带 Cache-Control），不产出 Blob、不占 JS 内存，
  // 供预览页提前加载上一张/下一张，切换时近乎即时
  warmup: (id: string): void => {
    const token = getToken();
    void fetch(`${API_BASE}/images/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  },

  // 用 XMLHttpRequest 以获得真实的上传进度回调（fetch 不支持上传进度）。
  // 视频走独立字段，并在上传前用浏览器截取封面帧（服务端没有 ffmpeg）
  upload: (
    albumId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<ImageItem> =>
    new Promise((resolve, reject) => {
      const isVideo = file.type.startsWith("video/");
      const token = getToken();
      const formData = new FormData();
      formData.append("albumId", albumId);
      // 文件名走普通文本字段（按 UTF-8 解码，无乱码问题）；
      // 直接放在 part header 里的 filename 会被服务端按 latin1 解码
      formData.append("name", file.name);

      const appendFile = () => {
        formData.append(isVideo ? "video" : "image", file);
        xhr.send(formData);
      };

      const startUpload = () => {
        if (isVideo) {
          extractVideoMeta(file)
            .then(({ poster, posterExt, width, height, duration }) => {
              if (poster) formData.append("poster", poster, `poster${posterExt}`);
              formData.append("width", String(width));
              formData.append("height", String(height));
              formData.append("duration", String(duration));
              appendFile();
            })
            .catch(() => appendFile());
        } else {
          appendFile();
        }
      };

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/images`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("上传响应解析失败"));
          }
        } else {
          let message = "上传失败";
          try {
            message = JSON.parse(xhr.responseText)?.message || message;
          } catch {
            // 保留默认错误信息
          }
          reject(new Error(message));
        }
      };
      xhr.onerror = () => reject(new Error("网络错误，上传失败"));
      startUpload();
    }),

  delete: (id: string): Promise<{ message: string }> =>
    request(`/images/${id}`, {
      method: "DELETE",
    }),
};

export const tagApi = {
  getAll: (): Promise<Tag[]> => request("/tags"),

  getByImage: (imageId: string): Promise<Tag[]> =>
    request(`/tags/image/${imageId}`),

  // imageId -> 标签列表 的批量映射，避免逐图请求
  getAlbumMap: (albumId: string): Promise<Record<string, Tag[]>> =>
    request(`/tags/album/${albumId}`),

  getImageMap: (): Promise<Record<string, Tag[]>> =>
    request("/tags/image-map"),

  create: (name: string, color: string): Promise<Tag> =>
    request("/tags", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    }),

  addToImage: (imageId: string, tagId: string): Promise<{ imageId: string; tagId: string }> =>
    request(`/tags/image/${imageId}`, {
      method: "POST",
      body: JSON.stringify({ tagId }),
    }),

  delete: (id: string): Promise<{ message: string }> =>
    request(`/tags/${id}`, {
      method: "DELETE",
    }),

  removeFromImage: (imageId: string, tagId: string): Promise<{ message: string }> =>
    request(`/tags/image/${imageId}/${tagId}`, {
      method: "DELETE",
    }),
};

export const slideshowApi = {
  getAll: (): Promise<Slideshow[]> => request("/slideshows"),

  getById: (id: string): Promise<SlideshowWithImages> =>
    request(`/slideshows/${id}`),

  create: (data: SlideshowCreateData): Promise<Slideshow> =>
    request("/slideshows", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: SlideshowUpdateData): Promise<Slideshow> =>
    request(`/slideshows/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<{ message: string }> =>
    request(`/slideshows/${id}`, {
      method: "DELETE",
    }),
};

export const accessKeyApi = {
  getAll: (): Promise<AccessKey[]> => request("/access-keys"),

  create: (key: string, permission: PermissionLevel, description?: string): Promise<AccessKey> =>
    request("/access-keys", {
      method: "POST",
      body: JSON.stringify({ key, permission, description }),
    }),

  update: (id: string, data: { permission?: PermissionLevel; description?: string; active?: boolean }): Promise<AccessKey> =>
    request(`/access-keys/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updateKey: (id: string, newKey: string): Promise<{ message: string }> =>
    request(`/access-keys/${id}/key`, {
      method: "PATCH",
      body: JSON.stringify({ newKey }),
    }),

  delete: (id: string): Promise<{ message: string }> =>
    request(`/access-keys/${id}`, {
      method: "DELETE",
    }),
};

// —— 回收站 ——
export interface RecycleBinItem {
  id: string;
  name: string;
  deletedAt: string;
  autoPurgeAt?: string | null;
}

export interface RecycleBinAlbum extends RecycleBinItem {
  imageCount: number;
}

export interface RecycleBinImage extends RecycleBinItem {
  albumId: string;
  albumName: string;
  type?: "image" | "video";
}

export interface RecycleBinData {
  // true 表示服务端关闭了到期自动清理（RECYCLE_RETENTION_DAYS <= 0）
  autoPurgeDisabled?: boolean;
  // 启用自动清理时的保留天数；关闭时为 null
  retentionDays?: number | null;
  albums: RecycleBinAlbum[];
  images: RecycleBinImage[];
}

export const recycleApi = {
  getBin: (): Promise<RecycleBinData> => request("/recycle-bin"),

  restoreAlbum: (id: string): Promise<{ message: string }> =>
    request(`/recycle-bin/albums/${id}/restore`, { method: "POST" }),

  restoreImage: (id: string): Promise<{ message: string }> =>
    request(`/recycle-bin/images/${id}/restore`, { method: "POST" }),

  purgeAlbum: (id: string): Promise<{ message: string }> =>
    request(`/recycle-bin/albums/${id}`, { method: "DELETE" }),

  purgeImage: (id: string): Promise<{ message: string }> =>
    request(`/recycle-bin/images/${id}`, { method: "DELETE" }),

  empty: (): Promise<{ message: string }> =>
    request("/recycle-bin", { method: "DELETE" }),
};

export interface Album {
  id: string;
  name: string;
  coverImageId: string | null;
  imageCount?: number;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImageItem {
  id: string;
  albumId: string;
  name: string;
  filePath: string;
  fileSize: number;
  width: number;
  height: number;
  mimeType: string;
  type?: "image" | "video";
  duration?: number | null;
  deletedAt?: string | null;
  createdAt: string;
}

// 列表接口的分页信封；不传分页参数时 limit 等于 total、totalPages 恒为 1
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Slideshow {
  id: string;
  name: string;
  transitionEffect: TransitionEffect;
  interval: number;
  autoPlay: boolean;
  imageCount?: number;
  createdAt: string;
}

export interface SlideshowImageItem {
  id: string;
  slideshowId: string;
  imageId: string;
  order: number;
  overlayText: string;
  textPosition: TextPosition;
  textColor: string;
  textSize: number;
}

export interface SlideshowImageInput {
  imageId: string;
  overlayText: string;
  textPosition: TextPosition;
  textColor: string;
  textSize: number;
}

export interface SlideshowWithImages extends Slideshow {
  images: SlideshowImageItem[];
}

export interface SlideshowCreateData {
  name: string;
  transitionEffect?: TransitionEffect;
  interval?: number;
  autoPlay?: boolean;
  images?: SlideshowImageInput[];
}

export type SlideshowUpdateData = Partial<SlideshowCreateData>;

export interface AccessKey {
  id: string;
  key: string;
  permission: PermissionLevel;
  active: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type TransitionEffect = "fade" | "slide" | "zoom" | "flip" | "blur";

export type TextPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

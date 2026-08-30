const API_BASE = import.meta.env.VITE_API_URL || "/api";

const tokenQuery = () => {
  const token = localStorage.getItem("token");
  return token ? `?token=${encodeURIComponent(token)}` : "";
};

export const getImageUrlWithAuth = (imageId: string): string =>
  `${API_BASE}/images/${imageId}${tokenQuery()}`;

// 网格/封面等小图用缩略图（服务端按需生成，体积约为原图的 1%）
export const getThumbnailUrlWithAuth = (imageId: string): string =>
  `${API_BASE}/images/${imageId}/thumbnail${tokenQuery()}`;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

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
  getByAlbum: (albumId: string): Promise<ImageItem[]> =>
    request(`/images/album/${albumId}`),

  getAll: (): Promise<ImageItem[]> => request("/images"),

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

  // 用 XMLHttpRequest 以获得真实的上传进度回调（fetch 不支持上传进度）
  upload: (
    albumId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<ImageItem> =>
    new Promise((resolve, reject) => {
      const token = getToken();
      const formData = new FormData();
      formData.append("albumId", albumId);
      formData.append("image", file);

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
      xhr.send(formData);
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

export interface Album {
  id: string;
  name: string;
  coverImageId: string | null;
  imageCount?: number;
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
  createdAt: string;
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

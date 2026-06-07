const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const getImageUrl = (imageId: string): string => {
  return `${API_BASE}/images/${imageId}`;
};

export const getImageUrlWithAuth = (imageId: string): string => {
  const token = localStorage.getItem("token");
  if (token) {
    return `${API_BASE}/images/${imageId}?token=${encodeURIComponent(token)}`;
  }
  return `${API_BASE}/images/${imageId}`;
};

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

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || `HTTP error ${response.status}`);
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
  
  getById: (id: string): Promise<Blob> => {
    const token = getToken();
    return fetch(`${API_BASE}/images/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(res => res.blob());
  },
  
  upload: (albumId: string, file: File): Promise<ImageItem> => {
    const token = getToken();
    const formData = new FormData();
    formData.append("albumId", albumId);
    formData.append("image", file);
    
    return fetch(`${API_BASE}/images`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(res => {
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    });
  },
  
  delete: (id: string): Promise<{ message: string }> =>
    request(`/images/${id}`, {
      method: "DELETE",
    }),
};

export const tagApi = {
  getAll: (): Promise<Tag[]> => request("/tags"),
  
  getByImage: (imageId: string): Promise<Tag[]> =>
    request(`/tags/image/${imageId}`),
  
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

export interface SlideshowUpdateData extends Partial<SlideshowCreateData> {}

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
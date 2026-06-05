import { create } from 'zustand';
import { db } from './db';
import type {
  Album,
  ImageItem,
  Tag,
  ImageTag,
  Slideshow,
  TransitionEffect,
  BlobRecord,
} from './types';

// Object URL tracking — not persisted in Zustand state
const objectUrls = new Map<string, string>();

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

// ─── Slice interfaces ────────────────────────────────────────────────

interface AlbumSlice {
  albums: Album[];
  currentAlbum: Album | null;
  fetchAlbums: () => Promise<void>;
  createAlbum: (name: string) => Promise<Album>;
  renameAlbum: (id: string, name: string) => Promise<void>;
  deleteAlbum: (id: string) => Promise<void>;
  setCurrentAlbum: (album: Album | null) => void;
}

interface ImageSlice {
  images: ImageItem[];
  fetchImagesByAlbum: (albumId: string) => Promise<void>;
  addImage: (albumId: string, file: File) => Promise<ImageItem>;
  deleteImage: (id: string) => Promise<void>;
  moveImage: (imageId: string, targetAlbumId: string) => Promise<void>;
}

interface TagSlice {
  tags: Tag[];
  fetchTags: () => Promise<void>;
  createTag: (name: string, color: string) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  addTagToImage: (imageId: string, tagId: string) => Promise<void>;
  removeTagFromImage: (imageId: string, tagId: string) => Promise<void>;
  getImageTags: (imageId: string) => Promise<Tag[]>;
}

interface SlideshowSlice {
  slideshows: Slideshow[];
  currentSlideshow: Slideshow | null;
  fetchSlideshows: () => Promise<void>;
  createSlideshow: (
    name: string,
    transitionEffect: TransitionEffect,
    interval: number,
    autoPlay: boolean,
  ) => Promise<Slideshow>;
  updateSlideshow: (
    id: string,
    updates: Partial<Pick<Slideshow, 'name' | 'transitionEffect' | 'interval' | 'autoPlay'>>,
  ) => Promise<void>;
  deleteSlideshow: (id: string) => Promise<void>;
  setCurrentSlideshow: (slideshow: Slideshow | null) => void;
}

interface UISlice {
  selectedImages: Set<string>;
  toggleImageSelection: (imageId: string) => void;
  clearSelection: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

type StoreState = AlbumSlice & ImageSlice & TagSlice & SlideshowSlice & UISlice;

// ─── Store ───────────────────────────────────────────────────────────

export const useStore = create<StoreState>((set) => ({
  // ── Album slice ──────────────────────────────────────────────────
  albums: [],
  currentAlbum: null,

  fetchAlbums: async () => {
    const albums = await db.albums.orderBy('createdAt').toArray();
    set({ albums });
  },

  createAlbum: async (name) => {
    const now = new Date().toISOString();
    const album: Album = {
      id: crypto.randomUUID(),
      name,
      coverImageId: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.albums.add(album);
    set((s) => ({ albums: [...s.albums, album] }));
    return album;
  },

  renameAlbum: async (id, name) => {
    const updatedAt = new Date().toISOString();
    await db.albums.update(id, { name, updatedAt });
    set((s) => ({
      albums: s.albums.map((a) => (a.id === id ? { ...a, name, updatedAt } : a)),
      currentAlbum: s.currentAlbum?.id === id ? { ...s.currentAlbum, name, updatedAt } : s.currentAlbum,
    }));
  },

  updateAlbumCover: async (id, coverImageId: string | null) => {
    const updatedAt = new Date().toISOString();
    await db.albums.update(id, { coverImageId, updatedAt });
    set((s) => ({
      albums: s.albums.map((a) => (a.id === id ? { ...a, coverImageId, updatedAt } : a)),
      currentAlbum: s.currentAlbum?.id === id ? { ...s.currentAlbum, coverImageId, updatedAt } : s.currentAlbum,
    }));
  },

  deleteAlbum: async (id) => {
    await db.albums.delete(id);
    set((s) => ({
      albums: s.albums.filter((a) => a.id !== id),
      currentAlbum: s.currentAlbum?.id === id ? null : s.currentAlbum,
    }));
  },

  setCurrentAlbum: (album) => {
    set({ currentAlbum: album });
  },

  // ── Image slice ──────────────────────────────────────────────────
  images: [],

  fetchImagesByAlbum: async (albumId) => {
    const images = await db.images
      .where('albumId')
      .equals(albumId)
      .sortBy('createdAt');
    // Ensure Object URLs exist for every image
    for (const image of images) {
      if (!objectUrls.has(image.id)) {
        const blobRecord = await db.blobs.get(image.blobKey);
        if (blobRecord) {
          objectUrls.set(image.id, URL.createObjectURL(blobRecord.data));
        }
      }
    }
    set({ images });
  },

  addImage: async (albumId, file) => {
    const { width, height } = await getImageDimensions(file);
    const blobKey = await db.blobs.add({ data: file } as BlobRecord);
    const objectUrl = URL.createObjectURL(file);
    const now = new Date().toISOString();

    const image: ImageItem = {
      id: crypto.randomUUID(),
      albumId,
      name: file.name,
      blobKey,
      fileSize: file.size,
      width,
      height,
      mimeType: file.type,
      createdAt: now,
    };

    await db.images.add(image);
    objectUrls.set(image.id, objectUrl);
    set((s) => ({ images: [...s.images, image] }));
    return image;
  },

  deleteImage: async (id) => {
    const image = await db.images.get(id);
    if (image) {
      await db.blobs.delete(image.blobKey);
      await db.imageTags.where('imageId').equals(id).delete();
      await db.images.delete(id);

      const url = objectUrls.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        objectUrls.delete(id);
      }
    }
    set((s) => ({
      images: s.images.filter((i) => i.id !== id),
      selectedImages: new Set([...s.selectedImages].filter((sid) => sid !== id)),
    }));
  },

  moveImage: async (imageId, targetAlbumId) => {
    await db.images.update(imageId, { albumId: targetAlbumId });
    set((s) => ({
      images: s.images.map((i) =>
        i.id === imageId ? { ...i, albumId: targetAlbumId } : i,
      ),
    }));
  },

  // ── Tag slice ────────────────────────────────────────────────────
  tags: [],

  fetchTags: async () => {
    const tags = await db.tags.toArray();
    set({ tags });
  },

  createTag: async (name, color) => {
    const tag: Tag = { id: crypto.randomUUID(), name, color };
    await db.tags.add(tag);
    set((s) => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  deleteTag: async (id) => {
    await db.imageTags.where('tagId').equals(id).delete();
    await db.tags.delete(id);
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }));
  },

  addTagToImage: async (imageId, tagId) => {
    const imageTag: ImageTag = { imageId, tagId };
    await db.imageTags.add(imageTag);
  },

  removeTagFromImage: async (imageId, tagId) => {
    await db.imageTags
      .where('[imageId+tagId]')
      .equals([imageId, tagId])
      .delete();
  },

  getImageTags: async (imageId) => {
    const links = await db.imageTags.where('imageId').equals(imageId).toArray();
    const tagIds = links.map((l) => l.tagId);
    if (tagIds.length === 0) return [];
    return db.tags.where('id').anyOf(tagIds).toArray();
  },

  // ── Slideshow slice ──────────────────────────────────────────────
  slideshows: [],
  currentSlideshow: null,

  fetchSlideshows: async () => {
    const slideshows = await db.slideshows.orderBy('createdAt').toArray();
    set({ slideshows });
  },

  createSlideshow: async (name, transitionEffect, interval, autoPlay) => {
    const slideshow: Slideshow = {
      id: crypto.randomUUID(),
      name,
      transitionEffect,
      interval,
      autoPlay,
      createdAt: new Date().toISOString(),
    };
    await db.slideshows.add(slideshow);
    set((s) => ({ slideshows: [...s.slideshows, slideshow] }));
    return slideshow;
  },

  updateSlideshow: async (id, updates) => {
    await db.slideshows.update(id, updates);
    set((s) => ({
      slideshows: s.slideshows.map((sl) =>
        sl.id === id ? { ...sl, ...updates } : sl,
      ),
      currentSlideshow:
        s.currentSlideshow?.id === id
          ? { ...s.currentSlideshow, ...updates }
          : s.currentSlideshow,
    }));
  },

  deleteSlideshow: async (id) => {
    await db.slideshowImages.where('slideshowId').equals(id).delete();
    await db.slideshows.delete(id);
    set((s) => ({
      slideshows: s.slideshows.filter((sl) => sl.id !== id),
      currentSlideshow: s.currentSlideshow?.id === id ? null : s.currentSlideshow,
    }));
  },

  setCurrentSlideshow: (slideshow) => {
    set({ currentSlideshow: slideshow });
  },

  // ── UI slice ─────────────────────────────────────────────────────
  selectedImages: new Set<string>(),

  toggleImageSelection: (imageId) => {
    set((s) => {
      const next = new Set(s.selectedImages);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return { selectedImages: next };
    });
  },

  clearSelection: () => {
    set({ selectedImages: new Set<string>() });
  },

  sidebarOpen: true,

  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
  },
}));

export { objectUrls };

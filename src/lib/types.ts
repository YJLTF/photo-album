export type TransitionEffect = 'fade' | 'slide' | 'zoom' | 'flip' | 'blur';

export type TextPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

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
  blobKey: number;
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

export interface ImageTag {
  imageId: string;
  tagId: string;
}

export interface Slideshow {
  id: string;
  name: string;
  transitionEffect: TransitionEffect;
  interval: number;
  autoPlay: boolean;
  createdAt: string;
}

export interface SlideshowImage {
  id: string;
  slideshowId: string;
  imageId: string;
  order: number;
  overlayText: string;
  textPosition: TextPosition;
  textColor: string;
  textSize: number;
}

export interface BlobRecord {
  id?: number;
  data: Blob;
}

import Dexie, { type Table } from 'dexie';
import type {
  Album,
  ImageItem,
  Tag,
  ImageTag,
  Slideshow,
  SlideshowImage,
  BlobRecord,
} from './types';

export class PhotoAlbumDB extends Dexie {
  albums!: Table<Album, string>;
  images!: Table<ImageItem, string>;
  tags!: Table<Tag, string>;
  imageTags!: Table<ImageTag, [string, string]>;
  slideshows!: Table<Slideshow, string>;
  slideshowImages!: Table<SlideshowImage, string>;
  blobs!: Table<BlobRecord, number>;

  constructor() {
    super('PhotoAlbumDB');
    this.version(1).stores({
      albums: 'id, name, coverImageId, createdAt, updatedAt',
      images: 'id, albumId, name, blobKey, fileSize, width, height, mimeType, createdAt',
      tags: 'id, &name, color',
      imageTags: '[imageId+tagId], imageId, tagId',
      slideshows: 'id, name, transitionEffect, interval, autoPlay, createdAt',
      slideshowImages: 'id, slideshowId, imageId, order, overlayText, textPosition, textColor, textSize',
      blobs: '++id, data',
    });
  }
}

export const db = new PhotoAlbumDB();

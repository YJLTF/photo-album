import type { ImageItem, Tag } from "./api";

export interface ImageFilterCriteria {
  /** 文件名搜索词（不区分大小写，按包含匹配） */
  query: string;
  /** 选中的标签 ID，取交集（图片需同时拥有全部标签） */
  selectedTagIds: string[];
}

/**
 * 标签筛选页的本地过滤逻辑（纯函数，便于测试）：
 * 先按文件名匹配搜索词，再要求图片同时拥有所有选中标签。
 */
export const filterImages = (
  images: ImageItem[],
  imageTagMap: Record<string, Tag[]>,
  { query, selectedTagIds }: ImageFilterCriteria
): ImageItem[] => {
  const normalizedQuery = query.trim().toLowerCase();
  return images.filter(img => {
    if (normalizedQuery && !img.name.toLowerCase().includes(normalizedQuery)) {
      return false;
    }
    if (selectedTagIds.length === 0) {
      return true;
    }
    const imgTags = imageTagMap[img.id] ?? [];
    return selectedTagIds.every(tagId => imgTags.some(t => t.id === tagId));
  });
};

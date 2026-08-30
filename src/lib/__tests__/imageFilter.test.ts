import { describe, it, expect } from "vitest";
import { filterImages } from "../imageFilter";
import type { ImageItem, Tag } from "../api";

const img = (id: string, name: string): ImageItem => ({
  id,
  albumId: "album-1",
  name,
  filePath: `${id}.jpg`,
  fileSize: 0,
  width: 0,
  height: 0,
  mimeType: "image/jpeg",
  createdAt: "2026-01-01T00:00:00Z",
});

const tag = (id: string): Tag => ({ id, name: id, color: "#E8845C" });

const images = [img("a", "Sunset.jpg"), img("b", "sunset-beach.png"), img("c", "Mountain.jpg")];

const tagMap: Record<string, Tag[]> = {
  a: [tag("t1")],
  b: [tag("t1"), tag("t2")],
  c: [tag("t2")],
};

describe("filterImages", () => {
  it("无搜索词且未选标签时返回全部图片", () => {
    expect(filterImages(images, tagMap, { query: "", selectedTagIds: [] })).toEqual(images);
  });

  it("搜索不区分大小写并按文件名包含匹配", () => {
    const result = filterImages(images, tagMap, { query: "SUNSET", selectedTagIds: [] });
    expect(result.map(i => i.id)).toEqual(["a", "b"]);
  });

  it("搜索词首尾空白不参与匹配", () => {
    const result = filterImages(images, tagMap, { query: "  mountain  ", selectedTagIds: [] });
    expect(result.map(i => i.id)).toEqual(["c"]);
  });

  it("单个标签：返回拥有该标签的图片", () => {
    const result = filterImages(images, tagMap, { query: "", selectedTagIds: ["t1"] });
    expect(result.map(i => i.id)).toEqual(["a", "b"]);
  });

  it("多标签取交集（需同时拥有全部标签）", () => {
    const result = filterImages(images, tagMap, { query: "", selectedTagIds: ["t1", "t2"] });
    expect(result.map(i => i.id)).toEqual(["b"]);
  });

  it("搜索词与标签同时生效", () => {
    const result = filterImages(images, tagMap, { query: "beach", selectedTagIds: ["t1"] });
    expect(result.map(i => i.id)).toEqual(["b"]);
  });

  it("无标签映射的图片按空标签处理", () => {
    const lone = [img("x", "Photo.jpg")];
    expect(filterImages(lone, {}, { query: "", selectedTagIds: ["t1"] })).toEqual([]);
    expect(filterImages(lone, {}, { query: "", selectedTagIds: [] })).toEqual(lone);
  });
});

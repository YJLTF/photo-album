import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Play, Tag as TagIcon, Trash2 } from "lucide-react";
import { albumApi, imageApi, tagApi, getThumbnailUrlWithAuth, type Album, type ImageItem, type Tag, type PermissionLevel } from "@/lib/api";
import ImageCard from "@/components/ImageCard";
import UploadZone from "@/components/UploadZone";
import Modal from "@/components/Modal";
import { toast } from "@/lib/toastStore";
import { mapWithConcurrency } from "@/lib/utils";

// 相册网格分页大小：一次只渲染一页，底部"加载更多"追加下一页
const PAGE_SIZE = 50;
// 服务端单次分页上限（routes/images.ts 的 parsePaging），合并请求时不能超过
const MAX_PAGE_LIMIT = 500;
// 批量操作的并发上限：上百张图片同时发请求会打满浏览器连接池
const BATCH_CONCURRENCY = 4;

export default function AlbumDetail() {
  const { albumId } = useParams();
  const navigate = useNavigate();
  const permission = localStorage.getItem("permission") as PermissionLevel;

  const [album, setAlbum] = useState<Album | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  // 删除/上传后按已加载的页数刷新，保持滚动位置；初始为第一页
  const loadedPagesRef = useRef(1);
  const [imageTags, setImageTags] = useState<Record<string, Tag[]>>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showBatchTagModal, setShowBatchTagModal] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [newTagId, setNewTagId] = useState("");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  const fetchPages = useCallback(async (pages: number) => {
    if (!albumId) return;
    try {
      // 相册、标签、图片-标签映射各一个请求，不再逐图查询
      const [albumData, tagsData, tagMap] = await Promise.all([
        albumApi.getById(albumId),
        tagApi.getAll(),
        tagApi.getAlbumMap(albumId),
      ]);
      setAlbum(albumData);
      setTags(tagsData);
      setImageTags(tagMap);

      const first = await imageApi.getByAlbum(albumId, 1, PAGE_SIZE);
      const pagesToLoad = Math.min(Math.max(pages, 1), first.totalPages);
      let items = first.items;
      if (pagesToLoad > 1) {
        // 需要的页数在服务端单次上限内时合成一个请求；超出（>10 页）才退回逐页串行
        if (pagesToLoad * PAGE_SIZE <= MAX_PAGE_LIMIT) {
          items = (await imageApi.getByAlbum(albumId, 1, pagesToLoad * PAGE_SIZE)).items;
        } else {
          for (let p = 2; p <= pagesToLoad; p++) {
            const extra = await imageApi.getByAlbum(albumId, p, PAGE_SIZE);
            items = [...items, ...extra.items];
          }
        }
      }
      loadedPagesRef.current = pagesToLoad;
      setImages(items);
      setTotal(first.total);
      setPage(pagesToLoad);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, [albumId]);

  const fetchData = useCallback(() => fetchPages(loadedPagesRef.current), [fetchPages]);

  useEffect(() => {
    fetchPages(1);
  }, [fetchPages]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchData();
    };
    window.addEventListener('tagDeleted', handleRefresh);
    window.addEventListener('tagCreated', handleRefresh);
    return () => {
      window.removeEventListener('tagDeleted', handleRefresh);
      window.removeEventListener('tagCreated', handleRefresh);
    };
  }, [fetchData]);

  const loadMore = useCallback(async () => {
    if (!albumId || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await imageApi.getByAlbum(albumId, next, PAGE_SIZE);
      loadedPagesRef.current = next;
      setPage(next);
      setTotal(data.total);
      setImages(prev => [...prev, ...data.items]);
    } catch (error) {
      console.error("Failed to load more:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [albumId, page, loadingMore]);

  const handleUpload = useCallback(async (
    files: FileList,
    onFileProgress?: (file: File, percent: number) => void
  ) => {
    if (!albumId) return;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await imageApi.upload(albumId, file, percent => onFileProgress?.(file, percent));
        onFileProgress?.(file, 100);
      }
      toast.success(files.length > 1 ? `已上传 ${files.length} 个文件` : "已上传");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    }
  }, [albumId, fetchData]);

  const handleDeleteImage = useCallback(async (id: string) => {
    if (!confirm("确定要删除这张照片吗？删除后可在回收站恢复。")) return;

    try {
      // 封面顺延由服务端在删除时处理（见后端 DELETE /images/:id）
      await imageApi.delete(id);
      toast.success("照片已移入回收站");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  }, [fetchData]);

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedImages);
    if (!confirm(`确定要删除选中的 ${ids.length} 张照片吗？删除后可在回收站恢复。`)) return;

    // 批量删除时封面顺延在本页数据里先算好，全部删完后一次性写回，
    // 避免逐张删除与服务端顺延互相覆盖
    const coverImageId = album?.coverImageId;
    const deletingCover = Boolean(coverImageId && selectedImages.has(coverImageId));
    let newCoverId: string | null = null;

    if (deletingCover) {
      const remainingImages = images.filter(img => !selectedImages.has(img.id));
      if (remainingImages.length > 0) {
        newCoverId = remainingImages[0].id;
      }
    }

    try {
      const results = await mapWithConcurrency(ids, BATCH_CONCURRENCY, async (id) => {
        try {
          await imageApi.delete(id);
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : "删除失败";
        }
      });
      const failures = results.filter((r): r is string => r !== null);

      if (failures.length === ids.length) {
        toast.error(failures[0]);
        return;
      }

      if (deletingCover) {
        await albumApi.update(albumId!, { coverImageId: newCoverId }).catch(() => {});
      }

      setSelectedImages(new Set());
      if (failures.length > 0) {
        toast.error(`已删除 ${ids.length - failures.length} 张，${failures.length} 张失败：${failures[0]}`);
      } else {
        toast.success(`已将 ${ids.length} 张照片移入回收站`);
      }
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量删除失败");
    }
  }, [selectedImages, album?.coverImageId, images, albumId, fetchData]);

  const handleAddTag = useCallback(async () => {
    if (!selectedImageId || !newTagId) return;
    try {
      await tagApi.addToImage(selectedImageId, newTagId);
      toast.success("标签已添加");
    } catch {
      // 忽略重复添加的错误
    }
    setShowTagModal(false);
    setNewTagId("");
    fetchData();
  }, [selectedImageId, newTagId, fetchData]);

  const handleBatchAddTag = useCallback(async () => {
    if (!newTagId || selectedImages.size === 0) return;

    // 验证标签是否存在
    const tagExists = tags.some(t => t.id === newTagId);
    if (!tagExists) {
      setNewTagId("");
      return;
    }

    const ids = Array.from(selectedImages);
    const tagIdToUse = newTagId;

    setShowBatchTagModal(false);
    setNewTagId("");
    setSelectedImages(new Set());

    try {
      // 有界并发：上百张图片同时打请求会占满浏览器连接池
      const results = await mapWithConcurrency(ids, BATCH_CONCURRENCY, async (id) => {
        try {
          await tagApi.addToImage(id, tagIdToUse);
          return null;
        } catch {
          // 单张失败（含重复添加）不中断其余
          return id;
        }
      });
      const failures = results.filter((r): r is string => r !== null);

      if (failures.length === 0) {
        toast.success(`已为 ${ids.length} 张照片添加标签`);
      } else {
        toast.error(`已为 ${ids.length - failures.length} 张添加标签，${failures.length} 张失败`);
      }
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量添加标签失败");
    }
  }, [newTagId, selectedImages, tags, fetchData]);

  const handleRemoveTag = useCallback(async (imageId: string, tagId: string) => {
    try {
      await tagApi.removeFromImage(imageId, tagId);
      setImageTags(prev => {
        const newTagsMap = { ...prev };
        if (newTagsMap[imageId]) {
          newTagsMap[imageId] = newTagsMap[imageId].filter(t => t.id !== tagId);
        }
        return newTagsMap;
      });
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  }, []);

  const handlePlaySlideshow = useCallback(() => {
    navigate(`/slideshow/play?albumId=${albumId}`);
  }, [albumId, navigate]);

  const toggleImageSelection = (id: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const canEdit = permission === "editor" || permission === "admin";

  if (!album) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center">
        <div className="text-[#F5F0EB]/50">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A2E] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#16213E]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate("/")}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors shrink-0"
                aria-label="返回"
              >
                <ArrowLeft size={20} className="text-[#F5F0EB]" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-[#F5F0EB] truncate font-display">
                  {album.name}
                </h1>
                <p className="text-sm text-[#F5F0EB]/50">{total} 个文件</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePlaySlideshow}
                disabled={images.length === 0}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
              >
                <Play size={16} />
                <span>轮播播放</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Batch actions bar */}
      {selectedImages.size > 0 && (
        <div className="bg-[#16213E] border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-sm text-[#F5F0EB]/70">已选择 {selectedImages.size} 张照片</span>
                <button
                  onClick={() => setSelectedImages(new Set())}
                  className="text-sm text-[#F5F0EB]/50 hover:text-[#F5F0EB] transition-colors"
                >
                  取消选择
                </button>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setSelectedImageId(Array.from(selectedImages)[0]);
                    setShowBatchTagModal(true);
                  }}
                  disabled={selectedImages.size === 0}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                >
                  <TagIcon size={14} />
                  <span>添加标签</span>
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedImages.size === 0}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>批量删除</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Upload zone */}
      {canEdit && (
        <div className="mb-6">
          <UploadZone onUpload={handleUpload} albumId={albumId!} compact />
        </div>
      )}

        {images.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {images.map((image) => (
                <ImageCard
                  key={image.id}
                  image={{
                    id: image.id,
                    url: getThumbnailUrlWithAuth(image.id),
                    name: image.name,
                    tags: imageTags[image.id] || [],
                  }}
                  isVideo={image.type === "video"}
                  onClick={() => navigate(`/preview/${image.id}`)}
                  onAddTag={() => {
                    setSelectedImageId(image.id);
                    setShowTagModal(true);
                  }}
                  onRemoveTag={(tagId) => handleRemoveTag(image.id, tagId)}
                  onDelete={canEdit ? () => handleDeleteImage(image.id) : undefined}
                  isSelected={selectedImages.has(image.id)}
                  onToggleSelect={() => toggleImageSelection(image.id)}
                  canEdit={canEdit}
                />
              ))}
            </div>
            {images.length < total && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-[#F5F0EB] transition-colors"
                >
                  {loadingMore ? "加载中..." : `加载更多（${images.length} / ${total}）`}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-[#E8845C]/10 flex items-center justify-center mb-6">
              <Plus size={48} className="text-[#E8845C]/60" />
            </div>
            <h3 className="text-xl font-semibold text-[#F5F0EB] mb-2 font-display">
              暂无照片
            </h3>
            <p className="text-[#F5F0EB]/50">上传一些照片到这个相册</p>
          </div>
        )}
      </main>

      {/* Add Tag Modal */}
      <Modal isOpen={showTagModal} onClose={() => setShowTagModal(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[#F5F0EB] mb-4 font-display">
            添加标签
          </h3>
          <select
            value={newTagId}
            onChange={(e) => setNewTagId(e.target.value)}
            className="w-full bg-[#1A1A2E] border border-white/10 rounded-lg px-4 py-2.5 text-[#F5F0EB] outline-none focus:border-[#E8845C]/50"
          >
            <option value="">选择标签...</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowTagModal(false)}
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-[#F5F0EB] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddTag}
              disabled={!newTagId}
              className="flex-1 px-4 py-2 bg-[#E8845C] hover:bg-[#E8845C]/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors"
            >
              添加
            </button>
          </div>
        </div>
      </Modal>

      {/* Batch Add Tag Modal */}
      <Modal isOpen={showBatchTagModal} onClose={() => {
        setShowBatchTagModal(false);
        setNewTagId("");
      }}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[#F5F0EB] mb-4 font-display">
            批量添加标签
          </h3>
          <p className="text-sm text-[#F5F0EB]/50 mb-4">将标签添加到 {selectedImages.size} 张照片</p>
          <select
            value={newTagId}
            onChange={(e) => setNewTagId(e.target.value)}
            className="w-full bg-[#1A1A2E] border border-white/10 rounded-lg px-4 py-2.5 text-[#F5F0EB] outline-none focus:border-[#E8845C]/50"
          >
            <option value="">选择标签...</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowBatchTagModal(false)}
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-[#F5F0EB] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleBatchAddTag}
              disabled={!newTagId}
              className="flex-1 px-4 py-2 bg-[#E8845C] hover:bg-[#E8845C]/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors"
            >
              添加
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

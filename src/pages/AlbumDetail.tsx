import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Play, Tag as TagIcon, Trash2 } from "lucide-react";
import { albumApi, imageApi, tagApi, getThumbnailUrlWithAuth, type Album, type ImageItem, type Tag, type PermissionLevel } from "@/lib/api";
import ImageCard from "@/components/ImageCard";
import UploadZone from "@/components/UploadZone";
import Modal from "@/components/Modal";
import { toast } from "@/lib/toastStore";

export default function AlbumDetail() {
  const { albumId } = useParams();
  const navigate = useNavigate();
  const permission = localStorage.getItem("permission") as PermissionLevel;

  const [album, setAlbum] = useState<Album | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [imageTags, setImageTags] = useState<Record<string, Tag[]>>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showBatchTagModal, setShowBatchTagModal] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [newTagId, setNewTagId] = useState("");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!albumId) return;
    try {
      // 相册、图片、标签、图片-标签映射各一个请求，不再逐图查询
      const [albumData, imagesData, tagsData, tagMap] = await Promise.all([
        albumApi.getById(albumId),
        imageApi.getByAlbum(albumId),
        tagApi.getAll(),
        tagApi.getAlbumMap(albumId),
      ]);
      setAlbum(albumData);
      setImages(imagesData);
      setTags(tagsData);
      setImageTags(tagMap);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, [albumId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleUpload = useCallback(async (
    files: FileList,
    onFileProgress?: (fileName: string, percent: number) => void
  ) => {
    if (!albumId) return;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await imageApi.upload(albumId, file, percent => onFileProgress?.(file.name, percent));
      }
      toast.success(`已上传 ${files.length} 张照片`);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    }
  }, [albumId, fetchData]);

  const handleDeleteImage = useCallback(async (id: string) => {
    if (!confirm("确定要删除这张照片吗？删除后可在回收站恢复。")) return;

    await imageApi.delete(id);

    // 如果删除的是封面图片，尝试设置新封面
    if (album?.coverImageId === id) {
      const remainingImages = images.filter(img => img.id !== id);
      if (remainingImages.length > 0) {
        await albumApi.update(albumId!, { coverImageId: remainingImages[0].id });
      } else {
        await albumApi.update(albumId!, { coverImageId: null });
      }
    }

    toast.success("照片已移入回收站");
    fetchData();
  }, [album?.coverImageId, images, albumId, fetchData]);

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedImages);
    if (!confirm(`确定要删除选中的 ${ids.length} 张照片吗？删除后可在回收站恢复。`)) return;

    // 检查是否删除封面图片
    const coverImageId = album?.coverImageId;
    const deletingCover = Boolean(coverImageId && selectedImages.has(coverImageId));
    let newCoverId: string | null = null;

    if (deletingCover) {
      const remainingImages = images.filter(img => !selectedImages.has(img.id));
      if (remainingImages.length > 0) {
        newCoverId = remainingImages[0].id;
      }
    }

    await Promise.all(ids.map(id => imageApi.delete(id)));

    // 更新封面
    if (deletingCover) {
      await albumApi.update(albumId!, { coverImageId: newCoverId });
    }

    setSelectedImages(new Set());
    toast.success(`已将 ${ids.length} 张照片移入回收站`);
    fetchData();
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

    await Promise.all(ids.map(async (id) => {
      try {
        await tagApi.addToImage(id, tagIdToUse);
      } catch {
        // 忽略重复添加的错误
      }
    }));

    toast.success(`已为 ${ids.length} 张照片添加标签`);
    fetchData();
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
    <div className="min-h-screen bg-[#1A1A2E]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#16213E]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/")}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                aria-label="返回"
              >
                <ArrowLeft size={20} className="text-[#F5F0EB]" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-[#F5F0EB]" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {album.name}
                </h1>
                <p className="text-sm text-[#F5F0EB]/50">{images.length} 张照片</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePlaySlideshow}
                disabled={images.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
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
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-[#F5F0EB]/70">已选择 {selectedImages.size} 张照片</span>
                <button
                  onClick={() => setSelectedImages(new Set())}
                  className="text-sm text-[#F5F0EB]/50 hover:text-[#F5F0EB] transition-colors"
                >
                  取消选择
                </button>
              </div>
              <div className="flex items-center gap-3">
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
      <main className="max-w-7xl mx-auto px-6 py-8">
      {/* Upload zone */}
      {canEdit && (
        <div className="mb-6">
          <UploadZone onUpload={handleUpload} albumId={albumId!} compact />
        </div>
      )}

        {images.length > 0 ? (
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
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-[#E8845C]/10 flex items-center justify-center mb-6">
              <Plus size={48} className="text-[#E8845C]/60" />
            </div>
            <h3 className="text-xl font-semibold text-[#F5F0EB] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              暂无照片
            </h3>
            <p className="text-[#F5F0EB]/50">上传一些照片到这个相册</p>
          </div>
        )}
      </main>

      {/* Add Tag Modal */}
      <Modal isOpen={showTagModal} onClose={() => setShowTagModal(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[#F5F0EB] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
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
          <h3 className="text-lg font-semibold text-[#F5F0EB] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
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

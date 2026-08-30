import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Tag as TagIcon, X, Search } from "lucide-react";
import { tagApi, imageApi, getThumbnailUrlWithAuth, type Tag, type ImageItem, type PermissionLevel } from "@/lib/api";
import { TAG_COLORS } from "@/lib/constants";
import { filterImages } from "@/lib/imageFilter";
import Modal from "@/components/Modal";
import VideoBadge from "@/components/VideoBadge";
import { toast } from "@/lib/toastStore";

// 选中标签用标签色作背景时，浅色（如黄色）配白字看不清；按亮度切换深浅文字
const contrastText = (hex: string): string => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16);
  const luminance = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luminance > 160 ? "#1A1A2E" : "#FFFFFF";
};

export default function Tags() {
  const navigate = useNavigate();
  const permission = localStorage.getItem("permission") as PermissionLevel;

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<ImageItem[]>([]);
  const [imageTagMap, setImageTagMap] = useState<Record<string, Tag[]>>({});
  const [filteredImages, setFilteredImages] = useState<ImageItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const fetchData = useCallback(async () => {
    try {
      // 标签、全部图片、全量 imageId->标签 映射各一个请求；之后筛选全在本地完成
      const [tagsData, allImages, imageMap] = await Promise.all([
        tagApi.getAll(),
        imageApi.getAll(),
        tagApi.getImageMap(),
      ]);
      setTags(tagsData);
      setImages(allImages.items);
      setImageTagMap(imageMap);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 纯同步过滤（逻辑在 lib/imageFilter，便于测试）：选中的标签取交集，搜索按文件名匹配
  useEffect(() => {
    setFilteredImages(
      filterImages(images, imageTagMap, {
        query: searchQuery,
        selectedTagIds: Array.from(selectedTags),
      })
    );
  }, [images, imageTagMap, selectedTags, searchQuery]);

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const color = TAG_COLORS[tags.length % TAG_COLORS.length];
      await tagApi.create(name, color);
      setNewTagName("");
      setShowCreateModal(false);
      fetchData();
      window.dispatchEvent(new Event('tagCreated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    }
  }, [newTagName, tags.length, fetchData]);

  const handleDeleteTag = useCallback(async (id: string) => {
    const tag = tags.find(t => t.id === id);
    if (!confirm(`确定要删除标签「${tag?.name ?? ""}」吗？该标签将从所有图片上移除。`)) return;
    try {
      await tagApi.delete(id);
      setSelectedTags(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      fetchData();
      window.dispatchEvent(new Event('tagDeleted'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  }, [tags, fetchData]);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const canEdit = permission === "editor" || permission === "admin";

  return (
    <div className="min-h-screen bg-[#1A1A2E] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#16213E]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-[#F5F0EB] font-display">
                标签筛选
              </h1>
              <p className="text-sm text-[#F5F0EB]/50 mt-1">
                {selectedTags.size > 0 ? `已选择 ${selectedTags.size} 个标签` : "选择标签来筛选图片"}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#E8845C] hover:bg-[#E8845C]/80 rounded-lg text-sm font-medium text-white transition-colors"
              >
                <Plus size={16} />
                <span>新建标签</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Tag filters */}
        <section className="mb-8">
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedTags.has(tag.id)
                    ? "shadow-[0_0_12px_rgba(232,132,92,0.25)]"
                    : "bg-white/5 text-[#F5F0EB]/60 hover:bg-white/10 hover:text-[#F5F0EB]"
                }`}
                style={{
                  backgroundColor: selectedTags.has(tag.id) ? tag.color : undefined,
                  color: selectedTags.has(tag.id) ? contrastText(tag.color) : undefined,
                  borderColor: tag.color,
                  borderWidth: selectedTags.has(tag.id) ? 0 : 1,
                  borderStyle: 'solid'
                }}
              >
                <TagIcon size={14} />
                <span>{tag.name}</span>
                {canEdit && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTag(tag.id);
                    }}
                    className="ml-1 hover:opacity-70 cursor-pointer"
                    role="button"
                    aria-label={`删除标签 ${tag.name}`}
                  >
                    <X size={14} />
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F5F0EB]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索图片..."
              className="w-full bg-[#16213E] border border-white/10 rounded-lg pl-12 pr-4 py-2.5 text-[#F5F0EB] placeholder-[#F5F0EB]/30 outline-none focus:border-[#E8845C]/50"
            />
          </div>
        </section>

        {/* Image grid */}
        <section>
          {filteredImages.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredImages.map((image) => (
                <div
                  key={image.id}
                  onClick={() => navigate(`/preview/${image.id}`)}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                >
                  <img
                    src={getThumbnailUrlWithAuth(image.id)}
                    alt={image.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                    decoding="async"
                  />
                  {image.type === "video" && <VideoBadge />}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <TagIcon size={48} className="text-[#F5F0EB]/20" />
              </div>
              <h3 className="text-xl font-semibold text-[#F5F0EB] mb-2 font-display">
                {selectedTags.size > 0 || searchQuery ? "没有匹配的图片" : "暂无图片"}
              </h3>
              <p className="text-[#F5F0EB]/50">尝试选择不同的标签或调整搜索条件</p>
            </div>
          )}
        </section>
      </main>

      {/* Create Tag Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[#F5F0EB] mb-4 font-display">
            新建标签
          </h3>
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="标签名称"
            className="w-full bg-[#1A1A2E] border border-white/10 rounded-lg px-4 py-2.5 text-[#F5F0EB] placeholder-[#F5F0EB]/30 outline-none focus:border-[#E8845C]/50"
            autoFocus
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowCreateModal(false)}
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-[#F5F0EB] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreateTag}
              className="flex-1 px-4 py-2 bg-[#E8845C] hover:bg-[#E8845C]/80 rounded-lg font-medium transition-colors"
            >
              创建
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

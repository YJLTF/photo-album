import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Tag as TagIcon, X, Search } from "lucide-react";
import { tagApi, imageApi, albumApi, getImageUrlWithAuth, type Tag, type ImageItem, type PermissionLevel } from "@/lib/api";
import Modal from "@/components/Modal";

const TAG_COLORS = ["#E8845C", "#5CE8A0", "#5CA8E8", "#E85CA0", "#A05CE8", "#E8D45C"];

export default function Tags() {
  const navigate = useNavigate();
  const permission = localStorage.getItem("permission") as PermissionLevel;
  
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<ImageItem[]>([]);
  const [filteredImages, setFilteredImages] = useState<ImageItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const tagsArray = Array.from(selectedTags);
    filterImages(tagsArray);
  }, [selectedTags.size, searchQuery]);

  const fetchData = async () => {
    try {
      const tagsData = await tagApi.getAll();
      setTags(tagsData);
      
      const allImages: ImageItem[] = [];
      const albums = await albumApi.getAll();
      
      for (const album of albums) {
        const albumImages = await imageApi.getByAlbum(album.id);
        allImages.push(...albumImages);
      }
      setImages(allImages);
      // 数据加载完成后立即执行过滤
      filterImages(Array.from(selectedTags));
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  const filterImages = async (selectedTagsArray: string[], sourceImages?: ImageItem[]) => {
    const imgs = sourceImages || images;
    
    if (selectedTagsArray.length === 0) {
      const filtered = imgs.filter(img => 
        img.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredImages(filtered);
      return;
    }

    const matched: Set<string> = new Set();
    for (const image of imgs) {
      if (!image.name.toLowerCase().includes(searchQuery.toLowerCase())) continue;
      
      const imageTags = await tagApi.getByImage(image.id);
      const hasAllTags = selectedTagsArray.every(tagId => 
        imageTags.some(it => it.id === tagId)
      );
      if (hasAllTags) {
        matched.add(image.id);
      }
    }
    
    setFilteredImages(imgs.filter(img => matched.has(img.id)));
  };

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    await tagApi.create(name, color);
    setNewTagName("");
    setShowCreateModal(false);
    fetchData();
    window.dispatchEvent(new Event('tagCreated'));
  }, [newTagName, tags.length]);

  const handleDeleteTag = useCallback(async (id: string) => {
    await tagApi.delete(id);
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    fetchData();
    window.dispatchEvent(new Event('tagDeleted'));
  }, []);

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
    // 在状态更新后执行过滤
    const newSet = new Set(selectedTags);
    if (newSet.has(tagId)) {
      newSet.delete(tagId);
    } else {
      newSet.add(tagId);
    }
    filterImages(Array.from(newSet), images);
  };

  const canEdit = permission === "editor" || permission === "admin";

  return (
    <div className="min-h-screen bg-[#1A1A2E]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#16213E]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#F5F0EB]" style={{ fontFamily: "'Playfair Display', serif" }}>
                标签筛选
              </h1>
              <p className="text-sm text-[#F5F0EB]/50 mt-1">
                {selectedTags.size > 0 ? `已选择 ${selectedTags.size} 个标签` : "选择标签来筛选图片"}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#E8845C] hover:bg-[#E8845C]/80 rounded-lg text-sm font-medium text-white transition-colors"
              >
                <Plus size={16} />
                <span>新建标签</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tag filters */}
        <section className="mb-8">
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedTags.has(tag.id)
                    ? "bg-opacity-100 text-white shadow-[0_0_12px_rgba(232,132,92,0.25)]"
                    : "bg-white/5 text-[#F5F0EB]/60 hover:bg-white/10 hover:text-[#F5F0EB]"
                }`}
                style={{ 
                  backgroundColor: selectedTags.has(tag.id) ? tag.color : undefined,
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
                  className="aspect-square rounded-lg overflow-hidden cursor-pointer group"
                >
                  <img
                    src={getImageUrlWithAuth(image.id)}
                    alt={image.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <TagIcon size={48} className="text-[#F5F0EB]/20" />
              </div>
              <h3 className="text-xl font-semibold text-[#F5F0EB] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                {selectedTags.size > 0 ? "没有匹配的图片" : "暂无筛选结果"}
              </h3>
              <p className="text-[#F5F0EB]/50">尝试选择不同的标签或调整搜索条件</p>
            </div>
          )}
        </section>
      </main>

      {/* Create Tag Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[#F5F0EB] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
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
              className="flex-1 px-4 py-2 bg-[#E8845C] hover:bg-[#E8845C]/80 rounded-lg font-medium text-white transition-colors"
            >
              创建
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
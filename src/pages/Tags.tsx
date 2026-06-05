import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, objectUrls } from "@/lib/store";
import { db } from "@/lib/db";
import type { ImageItem, TagItem } from "@/lib/types";
import TagPill from "@/components/TagPill";
import Modal from "@/components/Modal";
import { Plus, ImageOff, ArrowRight } from "lucide-react";

const TAG_COLORS = ["#E8845C", "#5CE8A0", "#5CA8E8", "#E85CA0", "#A05CE8", "#E8D45C"];

export default function Tags() {
  const navigate = useNavigate();
  const tags = useStore((s) => s.tags);
  const fetchTags = useStore((s) => s.fetchTags);
  const createTag = useStore((s) => s.createTag);
  const deleteTag = useStore((s) => s.deleteTag);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [imagesWithTags, setImagesWithTags] = useState<ImageItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [imageTags, setImageTags] = useState<Record<string, TagItem[]>>({});

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    const loadImagesByTags = async () => {
      if (selectedTags.length === 0) {
        setImagesWithTags([]);
        return;
      }

      const allImages = await db.images.toArray();
      const imageTagMap: Record<string, TagItem[]> = {};
      
      for (const img of allImages) {
        const imgTags = await db.imageTags
          .where("imageId")
          .equals(img.id)
          .toArray();
        
        const tagItems: TagItem[] = [];
        for (const imgTag of imgTags) {
          const tag = await db.tags.get(imgTag.tagId);
          if (tag) tagItems.push(tag);
        }
        imageTagMap[img.id] = tagItems;

        const hasAllTags = selectedTags.every(tagId => 
          tagItems.some(t => t.id === tagId)
        );
        
        if (hasAllTags) {
          if (!objectUrls.has(img.id)) {
            const blob = await db.blobs.get(img.blobKey);
            if (blob) objectUrls.set(img.id, URL.createObjectURL(blob.data));
          }
        }
      }

      setImageTags(imageTagMap);
      
      const filtered = allImages.filter(img => {
        return selectedTags.every(tagId => 
          imageTagMap[img.id].some(t => t.id === tagId)
        );
      });
      
      setImagesWithTags(filtered);
    };

    loadImagesByTags();
  }, [selectedTags]);

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    await createTag(name, color);
    setNewTagName("");
    setShowCreateModal(false);
  }, [newTagName, tags.length, createTag]);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleImageClick = (image: ImageItem) => {
    navigate(`/album/${image.albumId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1A2E] to-[#16213E] px-6 py-8 md:px-12 lg:px-20">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#F5F0EB]" style={{ fontFamily: "'Playfair Display', serif" }}>
            标签管理
          </h1>
          <p className="text-[#F5F0EB]/40 text-sm mt-1">
            点击标签筛选图片，支持多选组合筛选
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#E8845C] text-white rounded-xl text-sm font-medium hover:bg-[#d4734a] transition-colors"
        >
          <Plus size={18} />
          新建标签
        </button>
      </header>

      {/* Tags Filter */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[#F5F0EB] mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
          所有标签
        </h2>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 ? (
            <p className="text-[#F5F0EB]/40 text-sm">暂无标签，点击上方按钮创建</p>
          ) : (
            tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedTags.includes(tag.id)
                    ? "bg-opacity-100 text-white shadow-lg scale-105"
                    : "bg-opacity-20 text-[#F5F0EB]/70 hover:bg-opacity-40"
                }`}
                style={{ 
                  backgroundColor: selectedTags.includes(tag.id) ? tag.color : `${tag.color}20`,
                  border: selectedTags.includes(tag.id) ? `2px solid ${tag.color}` : "none"
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))
          )}
        </div>
      </section>

      {/* Selected Tags Summary */}
      {selectedTags.length > 0 && (
        <section className="mb-6 p-4 bg-[#1A1A2E]/50 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[#F5F0EB]/60 text-sm">已选择标签:</span>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map(tagId => {
                  const tag = tags.find(t => t.id === tagId);
                  return tag ? <TagPill key={tag.id} tag={tag} /> : null;
                })}
              </div>
            </div>
            <button
              onClick={() => setSelectedTags([])}
              className="text-sm text-[#E8845C] hover:text-[#d4734a] transition-colors"
            >
              清除筛选
            </button>
          </div>
        </section>
      )}

      {/* Images Grid */}
      <section>
        <h2 className="text-xl font-semibold text-[#F5F0EB] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
          {selectedTags.length > 0 ? `筛选结果 (${imagesWithTags.length} 张)` : "按标签筛选图片"}
        </h2>
        
        {selectedTags.length > 0 ? (
          imagesWithTags.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {imagesWithTags.map((img) => (
                <div
                  key={img.id}
                  onClick={() => handleImageClick(img)}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-white/5 cursor-pointer hover:border-[#E8845C]/30 transition-all duration-300 hover:scale-105"
                >
                  {objectUrls.get(img.id) ? (
                    <img 
                      src={objectUrls.get(img.id)!} 
                      alt={img.name} 
                      className="w-full h-full object-cover" 
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#16213E] flex items-center justify-center">
                      <ImageOff size={24} className="text-[#F5F0EB]/15" />
                    </div>
                  )}
                  
                  {/* Tags overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-wrap gap-1">
                      {imageTags[img.id]?.map(tag => (
                        <span
                          key={tag.id}
                          className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: `${tag.color}80`, color: "#fff" }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <ImageOff size={48} className="text-[#F5F0EB]/20 mb-4" />
              <p className="text-[#F5F0EB]/40">没有找到匹配的图片</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-[#1A1A2E]/30 rounded-2xl border border-dashed border-white/10">
            <div className="w-16 h-16 rounded-full bg-[#E8845C]/10 flex items-center justify-center mb-4">
              <ArrowRight size={24} className="text-[#E8845C]/60" />
            </div>
            <p className="text-[#F5F0EB]/40">点击上方标签开始筛选</p>
          </div>
        )}
      </section>

      {/* Create Tag Modal */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setNewTagName(""); }} title="新建标签">
        <input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
          placeholder="输入标签名称..."
          className="w-full bg-[#16213E] border border-white/10 rounded-xl px-4 py-3 text-[#F5F0EB] placeholder-[#F5F0EB]/30 focus:outline-none focus:border-[#E8845C]/50"
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => { setShowCreateModal(false); setNewTagName(""); }} className="px-4 py-2 text-sm text-[#F5F0EB]/60 hover:text-[#F5F0EB] transition-colors">取消</button>
          <button onClick={handleCreateTag} disabled={!newTagName.trim()} className="px-5 py-2 bg-[#E8845C] text-white rounded-lg text-sm font-medium hover:bg-[#d4734a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">创建</button>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, X, Info, ZoomIn, ZoomOut, Plus } from "lucide-react";
import { useStore, objectUrls } from "@/lib/store";
import { db } from "@/lib/db";
import type { Tag } from "@/lib/types";
import TagPill from "@/components/TagPill";
import Modal from "@/components/Modal";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImagePreview() {
  const { imageId } = useParams<{ imageId: string }>();
  const navigate = useNavigate();

  const images = useStore((s) => s.images);
  const deleteImage = useStore((s) => s.deleteImage);
  const tags = useStore((s) => s.tags);
  const fetchTags = useStore((s) => s.fetchTags);
  const addTagToImage = useStore((s) => s.addTagToImage);
  const removeTagFromImage = useStore((s) => s.removeTagFromImage);

  const [zoomed, setZoomed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [imageTags, setImageTags] = useState<Tag[]>([]);
  const [tagModalOpen, setTagModalOpen] = useState(false);

  const image = images.find((i) => i.id === imageId);
  const albumImages = images.filter((i) => i.albumId === image?.albumId);
  const currentIndex = albumImages.findIndex((i) => i.id === imageId);
  const prevImage = currentIndex > 0 ? albumImages[currentIndex - 1] : null;
  const nextImage = currentIndex < albumImages.length - 1 ? albumImages[currentIndex + 1] : null;

  const loadImageTags = useCallback(async () => {
    if (!imageId) return;
    const links = await db.imageTags.where("imageId").equals(imageId).toArray();
    const tagIds = links.map((l) => l.tagId);
    if (tagIds.length === 0) { setImageTags([]); return; }
    const result = await db.tags.where("id").anyOf(tagIds).toArray();
    setImageTags(result);
  }, [imageId]);

  useEffect(() => { fetchTags(); }, [fetchTags]);
  useEffect(() => { loadImageTags(); }, [loadImageTags]);

  const go = useCallback((id: string) => {
    setZoomed(false);
    navigate(`/preview/${id}`);
  }, [navigate]);

  const close = useCallback(() => navigate(-1), [navigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft" && prevImage) go(prevImage.id);
      if (e.key === "ArrowRight" && nextImage) go(nextImage.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close, go, prevImage, nextImage]);

  const handleAddTag = async (tagId: string) => {
    if (!imageId) return;
    await addTagToImage(imageId, tagId);
    await loadImageTags();
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!imageId) return;
    await removeTagFromImage(imageId, tagId);
    await loadImageTags();
  };

  const availableTags = tags.filter((t) => !imageTags.some((it) => it.id === t.id));

  if (!image) return null;
  const url = objectUrls.get(image.id);

  return (
    <div className="fixed inset-0 z-50 flex bg-[#0D0D1A]" onClick={() => zoomed && setZoomed(false)}>
      {/* Image area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {url && (
          <img
            src={url}
            alt={image.name}
            onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
            className={`max-w-full max-h-full object-contain transition-transform duration-300 cursor-zoom-in ${
              zoomed ? "scale-[2] cursor-zoom-out" : ""
            }`}
          />
        )}

        {/* Bottom control bar */}
        <div className="absolute bottom-0 inset-x-0 h-14 bg-black/50 backdrop-blur-md flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevImage && go(prevImage.id)}
              disabled={!prevImage}
              className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm text-white/70 font-medium min-w-[60px] text-center">
              {currentIndex + 1} / {albumImages.length}
            </span>
            <button
              onClick={() => nextImage && go(nextImage.id)}
              disabled={!nextImage}
              className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoomed((z) => !z)}
              className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              {zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
            </button>
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className={`p-2 rounded-full transition-colors ${sidebarOpen ? "text-[#E8845C] bg-[#E8845C]/10" : "text-white/70 hover:text-white hover:bg-white/10"}`}
            >
              <Info size={18} />
            </button>
            <button
              onClick={close}
              className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div
        className={`w-72 bg-[#0D0D1A]/90 backdrop-blur-md border-l border-white/5 transition-all duration-300 overflow-y-auto ${
          sidebarOpen ? "translate-x-0" : "translate-x-full w-0 border-l-0"
        }`}
      >
        <div className="p-5 space-y-6">
          {/* Image info */}
          <div>
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">图片信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-white/50">文件名</span><span className="text-white/90 truncate ml-2 max-w-[140px]" title={image.name}>{image.name}</span></div>
              <div className="flex justify-between"><span className="text-white/50">大小</span><span className="text-white/90">{formatSize(image.fileSize)}</span></div>
              <div className="flex justify-between"><span className="text-white/50">尺寸</span><span className="text-white/90">{image.width} × {image.height}</span></div>
              <div className="flex justify-between"><span className="text-white/50">上传时间</span><span className="text-white/90">{new Date(image.createdAt).toLocaleDateString()}</span></div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">标签</h3>
              {availableTags.length > 0 && (
                <button
                  onClick={() => setTagModalOpen(true)}
                  className="p-1 rounded-full text-white/50 hover:text-[#E8845C] hover:bg-[#E8845C]/10 transition-colors"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {imageTags.map((tag) => (
                <TagPill key={tag.id} tag={tag} onRemove={() => handleRemoveTag(tag.id)} />
              ))}
              {imageTags.length === 0 && <span className="text-xs text-white/30">暂无标签</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Add tag modal */}
      <Modal isOpen={tagModalOpen} onClose={() => setTagModalOpen(false)} title="添加标签">
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <TagPill
              key={tag.id}
              tag={tag}
              onToggle={async () => { await handleAddTag(tag.id); setTagModalOpen(false); }}
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}

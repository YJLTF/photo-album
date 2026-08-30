import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, Camera, Tag as TagIcon } from "lucide-react";
import {
  albumApi,
  imageApi,
  tagApi,
  slideshowApi,
  getThumbnailUrlWithAuth,
  type Album,
  type ImageItem,
  type Tag,
  type Slideshow,
  type PermissionLevel,
} from "@/lib/api";
import { TAG_COLORS, EFFECT_LABELS } from "@/lib/constants";
import AlbumCard from "@/components/AlbumCard";
import UploadZone from "@/components/UploadZone";
import TagPill from "@/components/TagPill";
import SlideshowCard from "@/components/SlideshowCard";
import Modal from "@/components/Modal";

export default function Home() {
  const navigate = useNavigate();
  const permission = localStorage.getItem("permission") as PermissionLevel;

  const [albums, setAlbums] = useState<Album[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [recentImages, setRecentImages] = useState<ImageItem[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [editingAlbum, setEditingAlbum] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const fetchData = useCallback(async () => {
    try {
      // 相册/轮播列表各自带 imageCount，最近照片走独立接口，全程只有 4 个请求
      const [albumsData, tagsData, slideshowsData, recent] = await Promise.all([
        albumApi.getAll(),
        tagApi.getAll(),
        slideshowApi.getAll(),
        imageApi.getRecent(8),
      ]);
      setAlbums(albumsData);
      setTags(tagsData);
      setSlideshows(slideshowsData);
      setRecentImages(recent);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateAlbum = useCallback(async () => {
    const name = newAlbumName.trim();
    if (!name) return;
    await albumApi.create(name);
    setNewAlbumName("");
    setShowCreateModal(false);
    fetchData();
  }, [newAlbumName, fetchData]);

  const handleRenameAlbum = useCallback(async () => {
    if (!editingAlbum || !editName.trim()) return;
    await albumApi.update(editingAlbum.id, { name: editName.trim() });
    setEditingAlbum(null);
    setEditName("");
    fetchData();
  }, [editingAlbum, editName, fetchData]);

  const handleDeleteAlbum = useCallback(async (id: string) => {
    const album = albums.find(a => a.id === id);
    if (!confirm(`确定要删除相册「${album?.name ?? ""}」吗？其中的 ${album?.imageCount ?? 0} 张图片将被永久删除。`)) return;
    await albumApi.delete(id);
    fetchData();
  }, [albums, fetchData]);

  const handleUpload = useCallback(async (
    files: FileList,
    onFileProgress?: (fileName: string, percent: number) => void
  ) => {
    if (!selectedAlbumId) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await imageApi.upload(selectedAlbumId, file, percent => onFileProgress?.(file.name, percent));
    }
    fetchData();
  }, [selectedAlbumId, fetchData]);

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    await tagApi.create(name, color);
    setNewTagName("");
    setShowTagModal(false);
    fetchData();
    window.dispatchEvent(new Event('tagCreated'));
  }, [newTagName, tags.length, fetchData]);

  const handleDeleteTag = useCallback(async (id: string) => {
    const tag = tags.find(t => t.id === id);
    if (!confirm(`确定要删除标签「${tag?.name ?? ""}」吗？`)) return;
    await tagApi.delete(id);
    fetchData();
    window.dispatchEvent(new Event('tagDeleted'));
  }, [tags, fetchData]);

  const handleDeleteSlideshow = useCallback(async (id: string) => {
    const slideshow = slideshows.find(s => s.id === id);
    if (!confirm(`确定要删除轮播「${slideshow?.name ?? ""}」吗？`)) return;
    await slideshowApi.delete(id);
    fetchData();
  }, [slideshows, fetchData]);

  const handleUpdateCover = useCallback(async (albumId: string, file: File) => {
    const newImage = await imageApi.upload(albumId, file);
    await albumApi.update(albumId, { coverImageId: newImage.id });
    fetchData();
  }, [fetchData]);

  const canEdit = permission === "editor" || permission === "admin";

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-[#F5F0EB]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#16213E]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>我的相册</h1>
              <p className="text-sm text-[#F5F0EB]/50 mt-1">管理您的照片和轮播</p>
            </div>
            {canEdit && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowTagModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm transition-colors"
                >
                  <TagIcon size={16} />
                  <span>新建标签</span>
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#E8845C] hover:bg-[#E8845C]/80 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus size={16} />
                  <span>新建相册</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Upload zone */}
        {canEdit && (
          <section className="mb-8">
            <div className="relative">
              {selectedAlbumId ? (
                <UploadZone onUpload={handleUpload} albumId={selectedAlbumId} />
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-white/10 bg-[#1A1A2E]/50 py-10 px-6 text-center">
                  <Camera size={32} className="mx-auto text-[#F5F0EB]/20 mb-3" />
                  <p className="text-[#F5F0EB]/40 text-sm mb-4">请先选择一个相册以上传图片</p>
                  {albums.length > 0 && (
                    <select
                      value={selectedAlbumId}
                      onChange={(e) => setSelectedAlbumId(e.target.value)}
                      className="bg-[#16213E] text-[#F5F0EB] border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#E8845C]/50"
                    >
                      <option value="">选择相册...</option>
                      {albums.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {selectedAlbumId && (
                <select
                  value={selectedAlbumId}
                  onChange={(e) => setSelectedAlbumId(e.target.value)}
                  className="absolute top-3 right-3 bg-[#16213E]/80 backdrop-blur-sm text-[#F5F0EB] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#E8845C]/50"
                >
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
            </div>
          </section>
        )}

        {/* Tags section */}
        {tags.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>标签</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <TagPill key={tag.id} tag={tag} onRemove={canEdit ? () => handleDeleteTag(tag.id) : undefined} />
              ))}
            </div>
          </section>
        )}

        {/* Album Grid */}
        {albums.length > 0 ? (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>所有相册</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {albums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={{
                    id: album.id,
                    name: album.name,
                    coverUrl: album.coverImageId ? getThumbnailUrlWithAuth(album.coverImageId) : undefined,
                    imageCount: album.imageCount ?? 0,
                  }}
                  onClick={() => navigate(`/album/${album.id}`)}
                  onEdit={canEdit ? () => { setEditingAlbum({ id: album.id, name: album.name }); setEditName(album.name); } : undefined}
                  onDelete={canEdit ? () => handleDeleteAlbum(album.id) : undefined}
                  onUploadCover={canEdit ? () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) await handleUpdateCover(album.id, file);
                    };
                    input.click();
                  } : undefined}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-[#E8845C]/10 flex items-center justify-center mb-6">
              <FolderOpen size={48} className="text-[#E8845C]/60" />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>暂无相册</h3>
            <p className="text-[#F5F0EB]/50 mb-6">创建您的第一个相册来开始整理照片</p>
            {canEdit && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#E8845C] hover:bg-[#E8845C]/80 rounded-lg font-medium transition-colors"
              >
                <Plus size={18} />
                <span>新建相册</span>
              </button>
            )}
          </section>
        )}

        {/* Recent images */}
        {recentImages.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>最近照片</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {recentImages.map((image) => (
                <div
                  key={image.id}
                  onClick={() => navigate(`/preview/${image.id}`)}
                  className="aspect-square rounded-lg overflow-hidden cursor-pointer group"
                >
                  <img
                    src={getThumbnailUrlWithAuth(image.id)}
                    alt={image.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Slideshows */}
        {slideshows.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>轮播方案</h2>
              {canEdit && (
                <button
                  onClick={() => navigate("/slideshow/edit")}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm transition-colors"
                >
                  <Plus size={16} />
                  <span>新建轮播</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {slideshows.map((slideshow) => (
                <SlideshowCard
                  key={slideshow.id}
                  slideshow={{
                    id: slideshow.id,
                    name: slideshow.name,
                    imageCount: slideshow.imageCount ?? 0,
                    transitionEffect: EFFECT_LABELS[slideshow.transitionEffect],
                  }}
                  onEdit={() => navigate(`/slideshow/edit?slideshowId=${slideshow.id}`)}
                  onDelete={canEdit ? () => handleDeleteSlideshow(slideshow.id) : undefined}
                  onPlay={() => navigate(`/slideshow/play?slideshowId=${slideshow.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Create Album Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>新建相册</h3>
          <input
            type="text"
            value={newAlbumName}
            onChange={(e) => setNewAlbumName(e.target.value)}
            placeholder="相册名称"
            className="w-full bg-[#1A1A2E] border border-white/10 rounded-lg px-4 py-2.5 text-[#F5F0EB] placeholder-[#F5F0EB]/30 outline-none focus:border-[#E8845C]/50"
            autoFocus
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowCreateModal(false)}
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreateAlbum}
              className="flex-1 px-4 py-2 bg-[#E8845C] hover:bg-[#E8845C]/80 rounded-lg font-medium transition-colors"
            >
              创建
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Album Modal */}
      {editingAlbum && (
        <Modal isOpen={!!editingAlbum} onClose={() => setEditingAlbum(null)}>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>编辑相册名称</h3>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-[#1A1A2E] border border-white/10 rounded-lg px-4 py-2.5 text-[#F5F0EB] outline-none focus:border-[#E8845C]/50"
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setEditingAlbum(null)}
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRenameAlbum}
                className="flex-1 px-4 py-2 bg-[#E8845C] hover:bg-[#E8845C]/80 rounded-lg font-medium transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Tag Modal */}
      <Modal isOpen={showTagModal} onClose={() => setShowTagModal(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>新建标签</h3>
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
              onClick={() => setShowTagModal(false)}
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg transition-colors"
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

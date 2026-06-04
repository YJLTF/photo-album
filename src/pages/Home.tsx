import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, Camera, Tag as TagIcon, Play } from "lucide-react";
import { useStore, objectUrls } from "@/lib/store";
import { db } from "@/lib/db";
import type { ImageItem } from "@/lib/types";
import AlbumCard from "@/components/AlbumCard";
import UploadZone from "@/components/UploadZone";
import TagPill from "@/components/TagPill";
import SlideshowCard from "@/components/SlideshowCard";
import Modal from "@/components/Modal";

const TAG_COLORS = ["#E8845C", "#5CE8A0", "#5CA8E8", "#E85CA0", "#A05CE8", "#E8D45C"];

export default function Home() {
  const navigate = useNavigate();
  const albums = useStore((s) => s.albums);
  const fetchAlbums = useStore((s) => s.fetchAlbums);
  const createAlbum = useStore((s) => s.createAlbum);
  const deleteAlbum = useStore((s) => s.deleteAlbum);
  const renameAlbum = useStore((s) => s.renameAlbum);
  const tags = useStore((s) => s.tags);
  const fetchTags = useStore((s) => s.fetchTags);
  const createTag = useStore((s) => s.createTag);
  const deleteTag = useStore((s) => s.deleteTag);
  const addImage = useStore((s) => s.addImage);
  const slideshows = useStore((s) => s.slideshows);
  const fetchSlideshows = useStore((s) => s.fetchSlideshows);
  const deleteSlideshow = useStore((s) => s.deleteSlideshow);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [editingAlbum, setEditingAlbum] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [recentImages, setRecentImages] = useState<ImageItem[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [imageCounts, setImageCounts] = useState<Record<string, number>>({});
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [slideshowImageCounts, setSlideshowImageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAlbums();
    fetchTags();
    fetchSlideshows();
    loadRecent();
  }, []);

  useEffect(() => {
    const loadCounts = async () => {
      const counts: Record<string, number> = {};
      for (const album of albums) {
        counts[album.id] = await db.images.where("albumId").equals(album.id).count();
      }
      setImageCounts(counts);
    };
    if (albums.length > 0) loadCounts();
  }, [albums]);

  useEffect(() => {
    const loadSlideshowCounts = async () => {
      const counts: Record<string, number> = {};
      for (const sl of slideshows) {
        counts[sl.id] = await db.slideshowImages.where("slideshowId").equals(sl.id).count();
      }
      setSlideshowImageCounts(counts);
    };
    if (slideshows.length > 0) loadSlideshowCounts();
  }, [slideshows]);

  const loadRecent = useCallback(async () => {
    const images = await db.images.orderBy("createdAt").reverse().limit(8).toArray();
    for (const img of images) {
      if (!objectUrls.has(img.id)) {
        const blob = await db.blobs.get(img.blobKey);
        if (blob) objectUrls.set(img.id, URL.createObjectURL(blob.data));
      }
    }
    setRecentImages(images);
  }, []);

  const handleCreate = useCallback(async () => {
    const name = newAlbumName.trim();
    if (!name) return;
    await createAlbum(name);
    setNewAlbumName("");
    setShowCreateModal(false);
  }, [newAlbumName, createAlbum]);

  const handleRename = useCallback(async () => {
    if (!editingAlbum || !editName.trim()) return;
    await renameAlbum(editingAlbum.id, editName.trim());
    setEditingAlbum(null);
    setEditName("");
  }, [editingAlbum, editName, renameAlbum]);

  const handleUpload = useCallback(async (files: FileList) => {
    if (!selectedAlbumId) return;
    for (let i = 0; i < files.length; i++) {
      await addImage(selectedAlbumId, files[i]);
    }
    loadRecent();
  }, [selectedAlbumId, addImage, loadRecent]);

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    await createTag(name, color);
    setNewTagName("");
    setShowTagModal(false);
  }, [newTagName, tags.length, createTag]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1A2E] to-[#16213E] px-6 py-8 md:px-12 lg:px-20">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[#F5F0EB]" style={{ fontFamily: "'Playfair Display', serif" }}>
          我的相册
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTagModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-[#F5F0EB] rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <TagIcon size={16} />
            管理标签
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#E8845C] text-white rounded-xl text-sm font-medium hover:bg-[#d4734a] transition-colors"
          >
            <Plus size={18} />
            新建相册
          </button>
        </div>
      </header>

      {/* Upload Zone */}
      <section className="mb-8">
        <div className="relative">
          {selectedAlbumId ? (
            <UploadZone onUpload={handleUpload} albumId={selectedAlbumId} />
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-white/10 bg-[#1A1A2E]/50 py-10 px-6 text-center">
              <Camera size={32} className="mx-auto text-[#F5F0EB]/20 mb-3" />
              <p className="text-[#F5F0EB]/40 text-sm mb-4">
                请先选择一个相册以上传图片
              </p>
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

      {/* Tags section */}
      {tags.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#F5F0EB] mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
            标签
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <TagPill key={tag.id} tag={tag} onRemove={() => deleteTag(tag.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Album Grid or Empty State */}
      {albums.length > 0 ? (
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#F5F0EB] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            所有相册
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={{
                  id: album.id,
                  name: album.name,
                  coverUrl: album.coverImageId ? objectUrls.get(album.coverImageId) : undefined,
                  imageCount: imageCounts[album.id] ?? 0,
                }}
                onClick={() => navigate(`/album/${album.id}`)}
                onEdit={() => { setEditingAlbum({ id: album.id, name: album.name }); setEditName(album.name); }}
                onDelete={() => deleteAlbum(album.id)}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 rounded-full bg-[#E8845C]/10 flex items-center justify-center mb-6">
            <FolderOpen size={48} className="text-[#E8845C]/60" />
          </div>
          <h2 className="text-2xl font-semibold text-[#F5F0EB] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            还没有相册
          </h2>
          <p className="text-[#F5F0EB]/40 text-sm mb-6">
            创建你的第一个相册，开始记录美好瞬间
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#E8845C] text-white rounded-xl text-sm font-medium hover:bg-[#d4734a] transition-colors"
          >
            <Plus size={18} />
            创建相册
          </button>
        </section>
      )}

      {/* Slideshows section */}
      {slideshows.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[#F5F0EB]" style={{ fontFamily: "'Playfair Display', serif" }}>
              轮播
            </h2>
            <button
              onClick={() => navigate("/slideshow/edit")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#E8845C] hover:bg-[#E8845C]/10 rounded-lg transition-colors"
            >
              <Plus size={14} /> 新建轮播
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {slideshows.map((sl) => (
              <SlideshowCard
                key={sl.id}
                slideshow={{
                  id: sl.id,
                  name: sl.name,
                  imageCount: slideshowImageCounts[sl.id] ?? 0,
                  transitionEffect: sl.transitionEffect,
                }}
                onPlay={() => navigate(`/slideshow/play?slideshowId=${sl.id}`)}
                onEdit={() => navigate(`/slideshow/edit?slideshowId=${sl.id}`)}
                onDelete={() => deleteSlideshow(sl.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent Uploads */}
      {recentImages.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-[#F5F0EB] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            最近上传
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {recentImages.map((img) => (
              <div
                key={img.id}
                onClick={() => navigate(`/album/${img.albumId}`)}
                className="aspect-square rounded-xl overflow-hidden border border-white/5 cursor-pointer hover:border-[#E8845C]/30 transition-all duration-300 hover:scale-105"
              >
                {objectUrls.get(img.id) ? (
                  <img src={objectUrls.get(img.id)!} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-[#16213E] flex items-center justify-center">
                    <Camera size={16} className="text-[#F5F0EB]/15" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Create Album Modal */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setNewAlbumName(""); }} title="新建相册">
        <input
          value={newAlbumName}
          onChange={(e) => setNewAlbumName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="输入相册名称..."
          className="w-full bg-[#16213E] border border-white/10 rounded-xl px-4 py-3 text-[#F5F0EB] placeholder-[#F5F0EB]/30 focus:outline-none focus:border-[#E8845C]/50"
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => { setShowCreateModal(false); setNewAlbumName(""); }} className="px-4 py-2 text-sm text-[#F5F0EB]/60 hover:text-[#F5F0EB] transition-colors">取消</button>
          <button onClick={handleCreate} disabled={!newAlbumName.trim()} className="px-5 py-2 bg-[#E8845C] text-white rounded-lg text-sm font-medium hover:bg-[#d4734a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">创建</button>
        </div>
      </Modal>

      {/* Rename Album Modal */}
      <Modal isOpen={!!editingAlbum} onClose={() => setEditingAlbum(null)} title="重命名相册">
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          className="w-full bg-[#16213E] border border-white/10 rounded-xl px-4 py-3 text-[#F5F0EB] placeholder-[#F5F0EB]/30 focus:outline-none focus:border-[#E8845C]/50"
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => setEditingAlbum(null)} className="px-4 py-2 text-sm text-[#F5F0EB]/60 hover:text-[#F5F0EB] transition-colors">取消</button>
          <button onClick={handleRename} disabled={!editName.trim()} className="px-5 py-2 bg-[#E8845C] text-white rounded-lg text-sm font-medium hover:bg-[#d4734a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">保存</button>
        </div>
      </Modal>

      {/* Create Tag Modal */}
      <Modal isOpen={showTagModal} onClose={() => { setShowTagModal(false); setNewTagName(""); }} title="管理标签">
        <div className="flex gap-2 mb-4">
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
            placeholder="输入标签名称..."
            className="flex-1 bg-[#16213E] border border-white/10 rounded-xl px-4 py-2.5 text-[#F5F0EB] placeholder-[#F5F0EB]/30 focus:outline-none focus:border-[#E8845C]/50 text-sm"
            autoFocus
          />
          <button onClick={handleCreateTag} disabled={!newTagName.trim()} className="px-4 py-2.5 bg-[#E8845C] text-white rounded-xl text-sm font-medium hover:bg-[#d4734a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            添加
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 && <p className="text-sm text-[#F5F0EB]/40">暂无标签，添加你的第一个标签吧</p>}
          {tags.map((tag) => (
            <TagPill key={tag.id} tag={tag} onRemove={() => deleteTag(tag.id)} />
          ))}
        </div>
      </Modal>
    </div>
  );
}

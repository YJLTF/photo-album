import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, FolderInput, Tag as TagIcon, ImageOff } from 'lucide-react';
import { useStore, objectUrls } from '@/lib/store';
import { db } from '@/lib/db';
import type { ImageTag } from '@/lib/types';
import ImageCard from '@/components/ImageCard';
import UploadZone from '@/components/UploadZone';
import TagPill from '@/components/TagPill';
import Modal from '@/components/Modal';

export default function AlbumDetail() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();

  const currentAlbum = useStore((s) => s.currentAlbum);
  const setCurrentAlbum = useStore((s) => s.setCurrentAlbum);
  const images = useStore((s) => s.images);
  const fetchImagesByAlbum = useStore((s) => s.fetchImagesByAlbum);
  const addImage = useStore((s) => s.addImage);
  const deleteImage = useStore((s) => s.deleteImage);
  const moveImage = useStore((s) => s.moveImage);
  const tags = useStore((s) => s.tags);
  const fetchTags = useStore((s) => s.fetchTags);
  const addTagToImage = useStore((s) => s.addTagToImage);
  const removeTagFromImage = useStore((s) => s.removeTagFromImage);
  const selectedImages = useStore((s) => s.selectedImages);
  const toggleImageSelection = useStore((s) => s.toggleImageSelection);
  const clearSelection = useStore((s) => s.clearSelection);
  const albums = useStore((s) => s.albums);
  const fetchAlbums = useStore((s) => s.fetchAlbums);
  const renameAlbum = useStore((s) => s.renameAlbum);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [imageTagMap, setImageTagMap] = useState<Map<string, Set<string>>>(new Map());
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [batchTagIds, setBatchTagIds] = useState<Set<string>>(new Set());

  // Fetch data
  useEffect(() => {
    if (albumId) {
      fetchImagesByAlbum(albumId);
      fetchTags();
      fetchAlbums();
      // Set current album
      db.albums.get(albumId).then((album) => {
        if (album) setCurrentAlbum(album);
      });
    }
  }, [albumId, fetchImagesByAlbum, fetchTags, fetchAlbums, setCurrentAlbum]);

  // Load image-tag mappings
  useEffect(() => {
    const allImageTags: ImageTag[] = [];
    db.imageTags.toArray().then((rows) => {
      const map = new Map<string, Set<string>>();
      for (const row of rows) {
        let set = map.get(row.imageId);
        if (!set) { set = new Set(); map.set(row.imageId, set); }
        set.add(row.tagId);
      }
      setImageTagMap(map);
    });
  }, [images]);

  // Filtered images by selected tags (AND logic)
  const filteredImages = selectedTagIds.size === 0
    ? images
    : images.filter((img) => {
        const imgTags = imageTagMap.get(img.id);
        if (!imgTags) return false;
        for (const tid of selectedTagIds) { if (!imgTags.has(tid)) return false; }
        return true;
      });

  // Editable name
  const startEdit = () => { if (currentAlbum) { setNameInput(currentAlbum.name); setEditingName(true); } };
  const commitName = async () => {
    if (currentAlbum && nameInput.trim() && nameInput.trim() !== currentAlbum.name) {
      await renameAlbum(currentAlbum.id, nameInput.trim());
    }
    setEditingName(false);
  };

  // Upload
  const handleUpload = useCallback(async (files: FileList) => {
    if (!albumId) return;
    for (const f of Array.from(files)) await addImage(albumId, f);
  }, [albumId, addImage]);

  // Batch delete
  const batchDelete = async () => {
    for (const id of selectedImages) await deleteImage(id);
    clearSelection();
  };

  // Batch move
  const batchMove = async (targetId: string) => {
    for (const id of selectedImages) await moveImage(id, targetId);
    clearSelection();
    setMoveModalOpen(false);
    if (albumId) await fetchImagesByAlbum(albumId);
  };

  // Batch tag
  const batchTag = async () => {
    for (const imgId of selectedImages) {
      for (const tagId of batchTagIds) await addTagToImage(imgId, tagId);
    }
    clearSelection();
    setBatchTagIds(new Set());
    setTagModalOpen(false);
  };

  const otherAlbums = albums.filter((a) => a.id !== albumId);
  const selCount = selectedImages.size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1A2E] to-[#16213E] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-[#F5F0EB]/70 hover:bg-white/10 hover:text-[#F5F0EB] transition-colors">
          <ArrowLeft size={18} />
        </button>
        {editingName ? (
          <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} onBlur={commitName} onKeyDown={(e) => e.key === 'Enter' && commitName()} autoFocus className="text-2xl font-bold text-[#F5F0EB] bg-transparent border-b-2 border-[#E8845C] outline-none px-1" style={{ fontFamily: "'Playfair Display', serif" }} />
        ) : (
          <h1 className="text-2xl font-bold text-[#F5F0EB] flex items-center gap-2 cursor-pointer group" onClick={startEdit} style={{ fontFamily: "'Playfair Display', serif" }}>
            {currentAlbum?.name ?? '相册'}
            <Pencil size={14} className="text-[#F5F0EB]/30 group-hover:text-[#E8845C] transition-colors" />
          </h1>
        )}
        <span className="text-sm text-[#F5F0EB]/40 ml-auto">{images.length} 张图片</span>
      </div>

      {/* Upload zone */}
      <div className="mb-6">
        <UploadZone onUpload={handleUpload} albumId={albumId} />
      </div>

      {/* Tag filter bar */}
      {tags.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tags.map((tag) => (
            <TagPill key={tag.id} tag={tag} selected={selectedTagIds.has(tag.id)} onToggle={() => {
              setSelectedTagIds((prev) => { const next = new Set(prev); next.has(tag.id) ? next.delete(tag.id) : next.add(tag.id); return next; });
            }} />
          ))}
        </div>
      )}

      {/* Image grid */}
      {filteredImages.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredImages.map((img) => (
            <ImageCard
              key={img.id}
              image={{ id: img.id, url: objectUrls.get(img.id) ?? '', name: img.name }}
              selected={selectedImages.has(img.id)}
              onSelect={() => toggleImageSelection(img.id)}
              onDelete={() => deleteImage(img.id)}
              onPreview={() => navigate(`/preview/${img.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-[#F5F0EB]/30">
          <ImageOff size={48} strokeWidth={1.5} />
          <p className="mt-4 text-sm">此相册暂无图片</p>
        </div>
      )}

      {/* Batch action bar */}
      {selCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#1A1A2E]/95 border border-white/10 backdrop-blur-md shadow-2xl z-40">
          <span className="text-sm text-[#F5F0EB]/70">已选 {selCount} 张</span>
          <button onClick={batchDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 text-sm transition-colors">
            <Trash2 size={14} /> 删除
          </button>
          <button onClick={() => setMoveModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E8845C]/15 text-[#E8845C] hover:bg-[#E8845C]/25 text-sm transition-colors">
            <FolderInput size={14} /> 移动
          </button>
          <button onClick={() => setTagModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 text-sm transition-colors">
            <TagIcon size={14} /> 标签
          </button>
        </div>
      )}

      {/* Move modal */}
      <Modal isOpen={moveModalOpen} onClose={() => setMoveModalOpen(false)} title="移动到相册">
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {otherAlbums.length === 0 && <p className="text-sm text-[#F5F0EB]/40">没有其他相册</p>}
          {otherAlbums.map((a) => (
            <button key={a.id} onClick={() => batchMove(a.id)} className="text-left px-4 py-2.5 rounded-xl bg-white/5 hover:bg-[#E8845C]/15 text-[#F5F0EB]/80 hover:text-[#E8845C] text-sm transition-colors">
              {a.name}
            </button>
          ))}
        </div>
      </Modal>

      {/* Tag modal */}
      <Modal isOpen={tagModalOpen} onClose={() => { setTagModalOpen(false); setBatchTagIds(new Set()); }} title="批量添加标签">
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map((tag) => (
            <TagPill key={tag.id} tag={tag} selected={batchTagIds.has(tag.id)} onToggle={() => {
              setBatchTagIds((prev) => { const next = new Set(prev); next.has(tag.id) ? next.delete(tag.id) : next.add(tag.id); return next; });
            }} />
          ))}
        </div>
        <button onClick={batchTag} disabled={batchTagIds.size === 0} className="w-full py-2 rounded-xl bg-[#E8845C] text-white font-medium text-sm hover:bg-[#E8845C]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          确认添加
        </button>
      </Modal>
    </div>
  );
}

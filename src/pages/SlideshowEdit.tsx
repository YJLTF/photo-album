import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Play, Save, Plus, Trash2, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { useStore, objectUrls } from '@/lib/store';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';
import TransitionPreview from '@/components/TransitionPreview';
import type { TransitionEffect, TextPosition, SlideshowImage, ImageItem } from '@/lib/types';

const EFFECTS: TransitionEffect[] = ['fade', 'slide', 'zoom', 'flip', 'blur'];
const POSITIONS: TextPosition[] = ['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right'];
const POS_LABELS: Record<TextPosition, string> = {
  'top-left': '左上', 'top-center': '上中', 'top-right': '右上',
  center: '居中', 'bottom-left': '左下', 'bottom-center': '下中', 'bottom-right': '右下',
};

interface SlideItem {
  imageId: string;
  overlayText: string;
  textPosition: TextPosition;
  textColor: string;
  textSize: number;
}

export default function SlideshowEdit() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const slideshowId = params.get('slideshowId');

  const albums = useStore(s => s.albums);
  const fetchAlbums = useStore(s => s.fetchAlbums);
  const fetchImagesByAlbum = useStore(s => s.fetchImagesByAlbum);
  const images = useStore(s => s.images);
  const createSlideshow = useStore(s => s.createSlideshow);
  const updateSlideshow = useStore(s => s.updateSlideshow);
  const setCurrentSlideshow = useStore(s => s.setCurrentSlideshow);

  const [name, setName] = useState('未命名轮播');
  const [effect, setEffect] = useState<TransitionEffect>('fade');
  const [interval, setInterval] = useState(3);
  const [autoPlay, setAutoPlay] = useState(true);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [selectedAlbumId, setSelectedAlbumId] = useState('');
  const [albumImages, setAlbumImages] = useState<ImageItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => { fetchAlbums(); }, [fetchAlbums]);

  // Load existing slideshow
  useEffect(() => {
    if (!slideshowId) return;
    (async () => {
      const sl = await db.slideshows.get(slideshowId);
      if (!sl) return;
      setExistingId(sl.id);
      setName(sl.name);
      setEffect(sl.transitionEffect);
      setInterval(sl.interval);
      setAutoPlay(sl.autoPlay);
      const si = await db.slideshowImages.where('slideshowId').equals(sl.id).sortBy('order');
      setSlides(si.map(s => ({
        imageId: s.imageId, overlayText: s.overlayText,
        textPosition: s.textPosition, textColor: s.textColor, textSize: s.textSize,
      })));
    })();
  }, [slideshowId]);

  // Load album images
  useEffect(() => {
    if (!selectedAlbumId) { setAlbumImages([]); return; }
    (async () => {
      const imgs = await db.images.where('albumId').equals(selectedAlbumId).sortBy('createdAt');
      for (const img of imgs) {
        if (!objectUrls.has(img.id)) {
          const blob = await db.blobs.get(img.blobKey);
          if (blob) objectUrls.set(img.id, URL.createObjectURL(blob.data));
        }
      }
      setAlbumImages(imgs);
    })();
  }, [selectedAlbumId]);

  // Ensure object URLs for slides
  const ensureUrl = useCallback(async (imageId: string) => {
    if (objectUrls.has(imageId)) return;
    const img = await db.images.get(imageId);
    if (!img) return;
    const blob = await db.blobs.get(img.blobKey);
    if (blob) objectUrls.set(imageId, URL.createObjectURL(blob.data));
  }, []);

  useEffect(() => { slides.forEach(s => ensureUrl(s.imageId)); }, [slides, ensureUrl]);

  const addSlide = (imageId: string) => {
    if (slides.some(s => s.imageId === imageId)) return;
    setSlides(prev => [...prev, { imageId, overlayText: '', textPosition: 'bottom-center', textColor: '#FFFFFF', textSize: 16 }]);
  };

  const removeSlide = (idx: number) => {
    setSlides(prev => prev.filter((_, i) => i !== idx));
    if (selectedIdx === idx) setSelectedIdx(-1);
    else if (selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    setSlides(prev => { const a = [...prev]; [a[idx], a[target]] = [a[target], a[idx]]; return a; });
    if (selectedIdx === idx) setSelectedIdx(target);
    else if (selectedIdx === target) setSelectedIdx(idx);
  };

  const updateSlide = (idx: number, patch: Partial<SlideItem>) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let sid = existingId;
      if (!sid) {
        const sl = await createSlideshow(name, effect, interval, autoPlay);
        sid = sl.id;
        setExistingId(sid);
      } else {
        await updateSlideshow(sid, { name, transitionEffect: effect, interval, autoPlay });
      }
      await db.slideshowImages.where('slideshowId').equals(sid).delete();
      if (slides.length > 0) {
        await db.slideshowImages.bulkAdd(slides.map((s, i) => ({
          id: crypto.randomUUID(), slideshowId: sid!, imageId: s.imageId,
          order: i, overlayText: s.overlayText, textPosition: s.textPosition,
          textColor: s.textColor, textSize: s.textSize,
        })));
      }
      const updated = await db.slideshows.get(sid);
      if (updated) setCurrentSlideshow(updated);
    } finally { setSaving(false); }
  };

  const slideImageIds = new Set(slides.map(s => s.imageId));

  return (
    <div className="h-screen flex flex-col bg-[#1A1A2E] text-[#F5F0EB]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-white/5 bg-[#16213E]">
        <h1 className="text-lg font-semibold whitespace-nowrap" style={{ fontFamily: "'Playfair Display', serif" }}>编辑轮播</h1>
        <input value={name} onChange={e => setName(e.target.value)}
          className="flex-1 max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-[#F5F0EB] outline-none focus:border-[#E8845C]/50" />
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#E8845C] hover:bg-[#E8845C]/80 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          <Save size={15} />{saving ? '保存中...' : '保存'}
        </button>
        <button onClick={() => { if (existingId) navigate(`/slideshow/play?slideshowId=${existingId}`); }}
          disabled={!existingId}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-30">
          <Play size={15} />预览
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left - Image Selection */}
        <aside className="w-56 border-r border-white/5 bg-[#16213E]/50 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5">
            <select value={selectedAlbumId} onChange={e => setSelectedAlbumId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-[#F5F0EB] outline-none">
              <option value="">选择相册...</option>
              {albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1.5 auto-rows-min content-start">
            {albumImages.map(img => {
              const added = slideImageIds.has(img.id);
              return (
                <button key={img.id} onClick={() => addSlide(img.id)}
                  className={cn('relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                    added ? 'border-[#E8845C]/50 opacity-50' : 'border-white/5 hover:border-white/20')}>
                  {objectUrls.has(img.id) ? <img src={objectUrls.get(img.id)} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/5 flex items-center justify-center"><ImageIcon size={16} className="text-white/20" /></div>}
                  {added && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Plus size={16} className="text-[#E8845C] rotate-45" /></div>}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center - Timeline */}
        <main className="flex-1 overflow-y-auto p-4 space-y-2">
          {slides.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-[#F5F0EB]/30 gap-2">
              <ImageIcon size={40} /><span className="text-sm">从左侧选择图片添加到轮播</span>
            </div>
          )}
          {slides.map((slide, idx) => {
            const url = objectUrls.get(slide.imageId);
            const selected = selectedIdx === idx;
            return (
              <div key={slide.imageId}
                onClick={() => setSelectedIdx(idx)}
                className={cn('flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer',
                  selected ? 'border-[#E8845C]/50 bg-[#E8845C]/5' : 'border-white/5 bg-white/[0.02] hover:border-white/10')}>
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-white/5">
                  {url ? <img src={url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-white/20" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <input value={slide.overlayText} onChange={e => updateSlide(idx, { overlayText: e.target.value })}
                    placeholder="叠加文字..."
                    className="w-full bg-transparent border-b border-white/5 text-sm py-0.5 outline-none focus:border-[#E8845C]/40 placeholder:text-white/20" />
                  <div className="flex items-center gap-2 mt-1">
                    <select value={slide.textPosition} onChange={e => updateSlide(idx, { textPosition: e.target.value as TextPosition })}
                      className="bg-white/5 border border-white/10 rounded px-1 py-0.5 text-xs outline-none text-[#F5F0EB]">
                      {POSITIONS.map(p => <option key={p} value={p}>{POS_LABELS[p]}</option>)}
                    </select>
                    <input type="color" value={slide.textColor} onChange={e => updateSlide(idx, { textColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent" />
                    <span className="text-xs text-white/30">{slide.textSize}px</span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={e => { e.stopPropagation(); moveSlide(idx, -1); }} className="p-1 rounded hover:bg-white/5"><ChevronUp size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); moveSlide(idx, 1); }} className="p-1 rounded hover:bg-white/5"><ChevronDown size={14} /></button>
                </div>
                <button onClick={e => { e.stopPropagation(); removeSlide(idx); }} className="p-1.5 rounded hover:bg-red-500/10 text-red-400/60 hover:text-red-400 shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </main>

        {/* Right - Settings */}
        <aside className="w-64 border-l border-white/5 bg-[#16213E]/50 overflow-y-auto p-4 space-y-5">
          <div>
            <label className="text-xs text-[#F5F0EB]/50 mb-1 block">轮播名称</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#E8845C]/50" />
          </div>
          <div>
            <label className="text-xs text-[#F5F0EB]/50 mb-2 block">转场效果</label>
            <div className="grid grid-cols-2 gap-2">
              {EFFECTS.map(e => (
                <button key={e} onClick={() => setEffect(e)}
                  className={cn('rounded-xl p-1.5 border transition-all', effect === e ? 'border-[#E8845C]/50 bg-[#E8845C]/5' : 'border-white/5 hover:border-white/10')}>
                  <TransitionPreview effect={e} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#F5F0EB]/50 mb-1 block">间隔时间: {interval}秒</label>
            <input type="range" min={1} max={10} value={interval} onChange={e => setInterval(Number(e.target.value))}
              className="w-full accent-[#E8845C]" />
          </div>
          <div>
            <label className="text-xs text-[#F5F0EB]/50 mb-1 block">文字大小: {selectedIdx >= 0 ? slides[selectedIdx]?.textSize : '-'}px</label>
            {selectedIdx >= 0 && (
              <input type="range" min={10} max={48} value={slides[selectedIdx].textSize}
                onChange={e => updateSlide(selectedIdx, { textSize: Number(e.target.value) })}
                className="w-full accent-[#E8845C]" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#F5F0EB]/50">自动播放</span>
            <button onClick={() => setAutoPlay(!autoPlay)}
              className={cn('w-10 h-5 rounded-full transition-colors relative', autoPlay ? 'bg-[#E8845C]' : 'bg-white/10')}>
              <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', autoPlay ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

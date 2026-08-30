import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Play, Save, Trash2, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { albumApi, imageApi, slideshowApi, getThumbnailUrlWithAuth, type Album, type ImageItem, type Slideshow, type TransitionEffect, type TextPosition, type PermissionLevel } from '@/lib/api';
import { EFFECT_LABELS } from '@/lib/constants';
import TransitionPreview from '@/components/TransitionPreview';
import { toast } from '@/lib/toastStore';

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
  const permission = localStorage.getItem("permission") as PermissionLevel;

  const [albums, setAlbums] = useState<Album[]>([]);
  const [name, setName] = useState('未命名轮播');
  const [effect, setEffect] = useState<TransitionEffect>('fade');
  // 命名为 intervalSec，避免与全局 setInterval 混淆
  const [intervalSec, setIntervalSec] = useState(3);
  const [autoPlay, setAutoPlay] = useState(true);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [selectedAlbumId, setSelectedAlbumId] = useState('');
  const [albumImages, setAlbumImages] = useState<ImageItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);

  const fetchAlbums = async () => {
    try {
      const data = await albumApi.getAll();
      setAlbums(data);
    } catch (error) {
      console.error('Failed to load albums:', error);
    }
  };

  const loadSlideshows = async () => {
    try {
      const data = await slideshowApi.getAll();
      setSlideshows(data);
    } catch (error) {
      console.error('Failed to load slideshows:', error);
    }
  };

  useEffect(() => {
    fetchAlbums();
    loadSlideshows();
  }, []);

  useEffect(() => {
    if (!selectedAlbumId) { setAlbumImages([]); return; }
    (async () => {
      // 轮播仅支持图片：视频不参与（播放节奏与定时器不匹配）
      const imgs = (await imageApi.getByAlbum(selectedAlbumId)).items.filter(i => i.type !== "video");
      setAlbumImages(imgs);
    })();
  }, [selectedAlbumId]);

  useEffect(() => {
    if (!slideshowId) return;
    (async () => {
      try {
        const sl = await slideshowApi.getById(slideshowId);
        setExistingId(sl.id);
        setName(sl.name);
        setEffect(sl.transitionEffect);
        setIntervalSec(sl.interval);
        setAutoPlay(sl.autoPlay);
        setSlides(sl.images.map(s => ({
          imageId: s.imageId, overlayText: s.overlayText,
          textPosition: s.textPosition, textColor: s.textColor, textSize: s.textSize,
        })));
        setSelectedIdx(-1);

        // 用元数据接口反查第一张图片所属相册，用于左侧可用图片预览；
        // 首图可能已被删除，查不到就保持当前相册选择
        if (sl.images.length > 0 && !selectedAlbumId) {
          try {
            const meta = await imageApi.getMeta(sl.images[0].imageId);
            const imgs = (await imageApi.getByAlbum(meta.albumId)).items.filter(i => i.type !== 'video');
            setSelectedAlbumId(meta.albumId);
            setAlbumImages(imgs);
          } catch {
            // 首图已被删除或不在任何相册，忽略
          }
        }
      } catch (error) {
        console.error('Failed to load slideshow:', error);
        toast.error(error instanceof Error ? error.message : '轮播加载失败');
      }
    })();
    // 仅在 slideshowId 变化时加载；selectedAlbumId 是"是否已手动选相册"的初始判断
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideshowId]);

  // 从下拉框切换/进入已保存轮播：只改 URL 参数，加载统一由上面的 effect 完成，
  // 避免 getById 拉两次
  const loadSlideshow = (id: string) => {
    const newParams = new URLSearchParams();
    newParams.set('slideshowId', id);
    navigate(`?${newParams.toString()}`);
  };

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
      const slideData = slides.map(s => ({
        imageId: s.imageId,
        overlayText: s.overlayText,
        textPosition: s.textPosition,
        textColor: s.textColor,
        textSize: s.textSize,
      }));

      if (existingId) {
        await slideshowApi.update(existingId, {
          name,
          transitionEffect: effect,
          interval: intervalSec,
          autoPlay,
          images: slideData,
        });
      } else {
        const newSlideshow = await slideshowApi.create({
          name,
          transitionEffect: effect,
          interval: intervalSec,
          autoPlay,
          images: slideData,
        });
        setExistingId(newSlideshow.id);
      }
      loadSlideshows();
      toast.success("轮播已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const canEdit = permission === "editor" || permission === "admin";

  return (
    <div className="h-screen flex flex-col bg-[#1A1A2E] text-[#F5F0EB] font-sans">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2 sm:gap-4 px-4 sm:px-6 py-3 border-b border-white/5 bg-[#16213E]">
        <h1 className="text-lg font-semibold whitespace-nowrap font-display">编辑轮播</h1>
        <select
          value={existingId || ''}
          onChange={e => {
            const val = e.target.value;
            if (val) {
              loadSlideshow(val);
            } else {
              setExistingId(null);
              setName('未命名轮播');
              setEffect('fade');
              setIntervalSec(3);
              setAutoPlay(true);
              setSlides([]);
              setSelectedIdx(-1);
              navigate('/slideshow/edit');
            }
          }}
          className="max-w-full sm:max-w-xs bg-[#1A1A2E] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-[#F5F0EB] outline-none focus:border-[#E8845C]/50">
          <option value="" className="bg-[#1A1A2E] text-[#F5F0EB]/60">选择已保存的轮播...</option>
          {slideshows.map(sl => (
            <option key={sl.id} value={sl.id} className="bg-[#1A1A2E] text-[#F5F0EB]">{sl.name}</option>
          ))}
        </select>
        <input value={name} onChange={e => setName(e.target.value)}
          className="flex-1 min-w-[8rem] max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-[#F5F0EB] outline-none focus:border-[#E8845C]/50" />
        {canEdit && (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#E8845C] hover:bg-[#E8845C]/80 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <Save size={15} />{saving ? '保存中...' : '保存'}
          </button>
        )}
        <button onClick={() => { if (existingId) navigate(`/slideshow/play?slideshowId=${existingId}`); }}
          disabled={!existingId}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-30">
          <Play size={15} />预览
        </button>
      </header>

      {/* Main content：移动端纵向堆叠，lg 起恢复左中右三栏 */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Left - Album selection and available images */}
        <div className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col">
          {/* Album selector */}
          <div className="p-4 border-b border-white/5">
            <label className="block text-xs text-[#F5F0EB]/50 mb-2">选择相册</label>
            <select
              value={selectedAlbumId}
              onChange={e => setSelectedAlbumId(e.target.value)}
              className="w-full bg-[#1A1A2E] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#F5F0EB] outline-none focus:border-[#E8845C]/50">
              <option value="" className="bg-[#1A1A2E] text-[#F5F0EB]/60">选择相册...</option>
              {albums.map(a => (
                <option key={a.id} value={a.id} className="bg-[#1A1A2E] text-[#F5F0EB]">{a.name}</option>
              ))}
            </select>
          </div>

          {/* Available images */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-medium mb-3">可用图片</h3>
            <div className="grid grid-cols-3 gap-2">
              {albumImages.map(img => (
                <button
                  key={img.id}
                  onClick={() => canEdit && addSlide(img.id)}
                  disabled={!canEdit || slides.some(s => s.imageId === img.id)}
                  className={`aspect-square rounded-lg overflow-hidden ${!canEdit || slides.some(s => s.imageId === img.id) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-[#E8845C]/50'}`}
                >
                  <img
                    src={getThumbnailUrlWithAuth(img.id)}
                    alt={img.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
            {albumImages.length === 0 && (
              <div className="text-center py-8 text-[#F5F0EB]/30 text-sm">
                {selectedAlbumId ? '该相册暂无图片' : '请选择相册'}
              </div>
            )}
          </div>
        </div>

        {/* Center - Slides */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 p-4 sm:p-6">
            {slides.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 lg:py-0">
                <ImageIcon size={48} className="text-[#F5F0EB]/15 mb-4" />
                <p className="text-[#F5F0EB]/40">从相册中选择图片添加到轮播</p>
              </div>
            ) : (
              <div className="space-y-4">
                {slides.map((slide, idx) => {
                  const img = albumImages.find(i => i.id === slide.imageId);
                  return (
                    <div
                      // 列表支持上下移动，用稳定的 imageId 作 key，避免索引 key 导致输入框错位
                      key={slide.imageId}
                      className={`flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all ${selectedIdx === idx ? 'bg-[#16213E] border-[#E8845C]/50' : 'bg-[#16213E]/50 border-white/5 hover:border-white/10'}`}
                      onClick={() => setSelectedIdx(idx)}
                    >
                      {/* Image thumbnail */}
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        {img ? (
                          <img
                            src={getThumbnailUrlWithAuth(img.id)}
                            alt={img.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center">
                            <ImageIcon size={24} className="text-[#F5F0EB]/20" />
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            value={slide.overlayText}
                            onChange={e => { if (canEdit) updateSlide(idx, { overlayText: e.target.value }); }}
                            placeholder="叠加文字..."
                            disabled={!canEdit}
                            className="flex-1 min-w-[7rem] bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-[#F5F0EB] placeholder-[#F5F0EB]/30 outline-none focus:border-[#E8845C]/50 disabled:cursor-not-allowed"
                          />
                          <select
                            value={slide.textPosition}
                            onChange={e => { if (canEdit) updateSlide(idx, { textPosition: e.target.value as TextPosition }); }}
                            disabled={!canEdit}
                            className="bg-[#1A1A2E] border border-white/10 rounded px-1 py-0.5 text-xs outline-none text-[#F5F0EB] focus:border-[#E8845C]/50 disabled:cursor-not-allowed">
                            {POSITIONS.map(p => <option key={p} value={p} className="bg-[#1A1A2E] text-[#F5F0EB]">{POS_LABELS[p]}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={slide.textColor}
                            onChange={e => { if (canEdit) updateSlide(idx, { textColor: e.target.value }); }}
                            disabled={!canEdit}
                            className="w-10 h-7 rounded cursor-pointer border border-white/10 disabled:cursor-not-allowed"
                          />
                          <span className="text-xs text-[#F5F0EB]/40">文字大小:</span>
                          <input
                            type="number"
                            value={slide.textSize}
                            onChange={e => { if (canEdit) updateSlide(idx, { textSize: parseInt(e.target.value) || 16 }); }}
                            disabled={!canEdit}
                            min="12" max="48"
                            className="w-16 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-[#F5F0EB] outline-none focus:border-[#E8845C]/50 disabled:cursor-not-allowed"
                          />
                          <span className="text-xs text-[#F5F0EB]/40">px</span>
                        </div>
                      </div>

                      {/* Move controls */}
                      <div className="flex flex-col justify-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); if (canEdit) moveSlide(idx, -1); }}
                          disabled={!canEdit || idx === 0}
                          className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (canEdit) moveSlide(idx, 1); }}
                          disabled={!canEdit || idx === slides.length - 1}
                          className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (canEdit) removeSlide(idx); }}
                          disabled={!canEdit}
                          className="p-1.5 rounded hover:bg-red-500/20 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed mt-auto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right - Settings */}
        <div className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-white/5 p-4 sm:p-5 lg:overflow-y-auto">
          <h3 className="text-sm font-medium mb-4">转场效果</h3>
          <div className="grid grid-cols-3 gap-2">
            {EFFECTS.map(effectName => (
              <button
                key={effectName}
                onClick={() => { if (canEdit) setEffect(effectName); }}
                disabled={!canEdit}
                className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${effect === effectName ? 'border-[#E8845C] ring-2 ring-[#E8845C]/30' : 'border-white/10 hover:border-white/20'} disabled:cursor-not-allowed`}
              >
                <TransitionPreview effect={effectName} compact />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                  <span className="text-xs text-white">{EFFECT_LABELS[effectName]}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="flex items-center justify-between text-sm mb-2">
                <span>间隔时间</span>
                <span className="text-[#F5F0EB]/50">{intervalSec} 秒</span>
              </label>
              <input
                type="range"
                min="1" max="60"
                value={intervalSec}
                onChange={e => { if (canEdit) setIntervalSec(parseInt(e.target.value)); }}
                disabled={!canEdit}
                className="w-full accent-[#E8845C] disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">自动播放</span>
              <button
                onClick={() => { if (canEdit) setAutoPlay(!autoPlay); }}
                disabled={!canEdit}
                className={`w-12 h-6 rounded-full transition-colors ${autoPlay ? 'bg-[#E8845C]' : 'bg-white/20'} disabled:cursor-not-allowed`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${autoPlay ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

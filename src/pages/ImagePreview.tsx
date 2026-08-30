import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { imageApi, getImageUrlWithAuth, type ImageItem } from '@/lib/api';

export default function ImagePreview() {
  const { imageId } = useParams();
  const navigate = useNavigate();

  const [image, setImage] = useState<ImageItem | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [albumImages, setAlbumImages] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState(false);
  const [showControls, setShowControls] = useState(false);
  // 切换图片时原图下载中，显示轻量指示器
  const [switching, setSwitching] = useState(false);

  const hideTimerRef = useRef<number | null>(null);
  // 当前展示中的 object URL，切换时释放旧的，卸载时释放最后的
  const displayedUrlRef = useRef<string | null>(null);
  // 触屏滑动切换的起点；缩放/旋转状态下不响应，避免和查看操作打架
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = window.setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    document.addEventListener('mousemove', resetHideTimer);
    // 触屏没有 mousemove，靠 touchstart 唤起控制条
    document.addEventListener('touchstart', resetHideTimer);
    return () => {
      document.removeEventListener('mousemove', resetHideTimer);
      document.removeEventListener('touchstart', resetHideTimer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  const showImage = useCallback(async (img: ImageItem) => {
    // 视频不整体下载成 Blob（大文件占内存），直接用带媒体令牌的 URL，
    // 服务端 sendFile 支持 Range，可拖动进度条；URL 不可回收，只清理 Blob
    if (img.type === 'video') {
      if (displayedUrlRef.current) {
        URL.revokeObjectURL(displayedUrlRef.current);
        displayedUrlRef.current = null;
      }
      setImage(img);
      setImageUrl(getImageUrlWithAuth(img.id));
      return;
    }
    setSwitching(true);
    try {
      const blob = await imageApi.getById(img.id);
      const url = URL.createObjectURL(blob);
      if (displayedUrlRef.current) URL.revokeObjectURL(displayedUrlRef.current);
      displayedUrlRef.current = url;
      setImage(img);
      setImageUrl(url);
    } finally {
      setSwitching(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!imageId) return;
      try {
        // 元数据接口反查所属相册，只需两个请求即可定位浏览上下文
        const meta = await imageApi.getMeta(imageId);
        const siblings = (await imageApi.getByAlbum(meta.albumId)).items;
        const ordered = [...siblings].sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        if (cancelled) return;
        setAlbumImages(ordered);
        setCurrentIndex(Math.max(ordered.findIndex(i => i.id === imageId), 0));
        await showImage(meta);
      } catch {
        if (!cancelled) setError(true);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (displayedUrlRef.current) {
        URL.revokeObjectURL(displayedUrlRef.current);
        displayedUrlRef.current = null;
      }
    };
  }, [imageId, showImage]);

  // 预取上一张/下一张原图进浏览器缓存（服务端带 Cache-Control），切换时近乎即时
  useEffect(() => {
    if (albumImages.length === 0) return;
    for (const offset of [1, -1]) {
      const neighbor = albumImages[(currentIndex + offset + albumImages.length) % albumImages.length];
      if (neighbor && neighbor.type !== 'video') {
        imageApi.warmup(neighbor.id);
      }
    }
  }, [currentIndex, albumImages]);

  const goNext = useCallback(async () => {
    if (albumImages.length === 0) return;
    const nextIndex = (currentIndex + 1) % albumImages.length;
    setCurrentIndex(nextIndex);
    try {
      await showImage(albumImages[nextIndex]);
    } catch {
      // 加载失败保持当前图，不打断浏览
    }
  }, [currentIndex, albumImages, showImage]);

  const goPrev = useCallback(async () => {
    if (albumImages.length === 0) return;
    const prevIndex = (currentIndex - 1 + albumImages.length) % albumImages.length;
    setCurrentIndex(prevIndex);
    try {
      await showImage(albumImages[prevIndex]);
    } catch {
      // 同上
    }
  }, [currentIndex, albumImages, showImage]);

  const zoomIn = useCallback(() => setScale(prev => Math.min(prev + 0.25, 3)), []);
  const zoomOut = useCallback(() => setScale(prev => Math.max(prev - 0.25, 0.5)), []);
  const resetZoom = useCallback(() => { setScale(1); setRotation(0); }, []);
  const rotate = useCallback(() => setRotation(prev => (prev + 90) % 360), []);

  // 触屏左右滑动切换上一张/下一张
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    // 已缩放或旋转时松手语义不明确，不做滑动切换
    if (scale !== 1 || rotation !== 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 水平位移足够大且明显大于垂直位移才切换，避免误伤轻微斜向滑动
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext();
      else goPrev();
    }
  }, [scale, rotation, goNext, goPrev]);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = image?.name || 'image.jpg';
    link.click();
  }, [imageUrl, image?.name]);

  const exit = useCallback(() => navigate(-1), [navigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') exit();
      else if (e.key === '+') { e.preventDefault(); zoomIn(); }
      else if (e.key === '-') { e.preventDefault(); zoomOut(); }
      else if (e.key === '0') { e.preventDefault(); resetZoom(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, zoomIn, zoomOut, resetZoom, exit]);

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 text-white/60">
        <p>文件不存在或已被删除</p>
        <button
          onClick={exit}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
        >
          返回
        </button>
      </div>
    );
  }

  if (!image || !imageUrl) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white/50">
        加载中...
      </div>
    );
  }

  const isVideo = image.type === 'video';

  return (
    <div className="fixed inset-0 bg-black">
      {/* Media */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {isVideo ? (
          <video
            key={imageUrl}
            src={imageUrl}
            controls
            playsInline
            autoPlay
            className="max-w-full max-h-full"
          />
        ) : (
          <img
            src={imageUrl}
            alt={image.name}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
            }}
          />
        )}
        {switching && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-9 h-9 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Top bar */}
        <div className="pointer-events-auto absolute top-0 left-0 right-0 p-3 sm:p-4 flex justify-between items-center gap-3">
          <div className="text-white/80 text-sm max-w-[60%] sm:max-w-xs truncate">
            {image.name}
          </div>
          <button
            onClick={exit}
            className="p-2 sm:p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Bottom bar（缩放/旋转仅对图片有意义，视频隐藏） */}
        <div className="pointer-events-auto absolute bottom-0 left-0 right-0 p-3 sm:p-4">
          <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
            {!isVideo && (
              <>
                <button onClick={zoomOut} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <ZoomOut size={20} />
                </button>
                <button onClick={resetZoom} className="px-3 sm:px-4 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">
                  {Math.round(scale * 100)}%
                </button>
                <button onClick={zoomIn} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <ZoomIn size={20} />
                </button>
                <div className="w-px h-8 bg-white/20 mx-1 sm:mx-2" />
                <button onClick={rotate} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <RotateCw size={20} />
                </button>
              </>
            )}
            <button onClick={handleDownload} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
              <Download size={20} />
            </button>
          </div>
          <div className="text-center text-white/50 text-sm mt-3">
            {currentIndex + 1} / {albumImages.length}
          </div>
        </div>

        {/* Navigation */}
        <button
          onClick={goPrev}
          className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <button
          onClick={goNext}
          className="pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <ArrowRight size={24} />
        </button>
      </div>
    </div>
  );
}

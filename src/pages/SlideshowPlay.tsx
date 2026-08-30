import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { slideshowApi, imageApi, type SlideshowWithImages, type SlideshowImageItem } from '@/lib/api';
import { getOverlayPositionStyle } from '@/lib/overlayPosition';

// 预取窗口：提前加载当前张的下一张/上一张，切换时近乎即时；其余按需加载，避免
// 开播前把整个轮播的原图全部下载完（大相册会等待数百 MB）
const PRELOAD_WINDOW = [0, 1, -1] as const;

interface SlideshowMeta {
  id: string;
  name: string;
  transitionEffect: SlideshowWithImages['transitionEffect'];
  interval: number;
  autoPlay: boolean;
  images: SlideshowImageItem[];
}

export default function SlideshowPlay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const slideshowId = params.get('slideshowId');
  const albumId = params.get('albumId');

  const [currentSlideshow, setCurrentSlideshow] = useState<SlideshowMeta | null>(null);
  // 实际可播放（加载成功）的图片 id 顺序；已删除的图片在加载时被发现并跳过
  const [slideIds, setSlideIds] = useState<string[]>([]);
  // 已加载完成的 objectURL，按图片 id 索引
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [error, setError] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [transitionClass, setTransitionClass] = useState('');

  const hideTimerRef = useRef<number | null>(null);
  // goNext/goPrev 里切页用的 setTimeout，卸载时清理，避免对已卸载组件 setState
  const transitionTimerRef = useRef<number | null>(null);
  // 正在过渡时忽略后续切换，防止快速连点导致状态错乱
  const transitioningRef = useRef(false);
  const urlMapRef = useRef<Record<string, string>>({});
  const failedIdsRef = useRef<Set<string>>(new Set());
  // 本次会话创建的全部 objectURL，仅在卸载时释放（刷新列表时不能吊销正在显的 URL）
  const createdUrlsRef = useRef<string[]>([]);

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = window.setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    document.addEventListener('mousemove', resetHideTimer);
    document.addEventListener('touchstart', resetHideTimer);
    return () => {
      document.removeEventListener('mousemove', resetHideTimer);
      document.removeEventListener('touchstart', resetHideTimer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // 加载轮播/相册的元数据（不预载图片本体，图片由预取窗口按需加载）
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        if (slideshowId) {
          const slideshow = await slideshowApi.getById(slideshowId);
          if (cancelled) return;
          if (slideshow.images.length === 0) {
            setError('轮播中还没有图片');
            return;
          }
          setCurrentSlideshow(slideshow);
        } else if (albumId) {
          // 相册轮播按图片处理，视频不参与（服务端无 ffmpeg 转码，播放节奏与定时器不匹配）
          const albumImages = (await imageApi.getByAlbum(albumId)).items.filter(i => i.type !== 'video');
          if (cancelled) return;
          if (albumImages.length === 0) {
            setError('相册中没有图片');
            return;
          }
          setCurrentSlideshow({
            id: 'album',
            name: '相册轮播',
            transitionEffect: 'fade',
            interval: 3,
            autoPlay: true,
            images: albumImages.map((img, idx): SlideshowImageItem => ({
              id: img.id,
              slideshowId: 'album',
              imageId: img.id,
              order: idx,
              overlayText: '',
              textPosition: 'bottom-center',
              textColor: '#FFFFFF',
              textSize: 16,
            })),
          });
        } else {
          setError('缺少轮播或相册参数');
        }
      } catch {
        if (!cancelled) setError('加载失败，请稍后重试');
      }
    };

    fetchData();

    return () => {
      cancelled = true;
      createdUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      createdUrlsRef.current = [];
      urlMapRef.current = {};
      failedIdsRef.current = new Set();
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      setSlideIds([]);
      setUrlMap({});
      setCurrentIndex(0);
    };
  }, [slideshowId, albumId]);

  // 元数据就绪后重置播放状态；首帧直接进入 -in 态，避免 slide/flip 效果下第一张不可见
  useEffect(() => {
    if (!currentSlideshow) return;
    setSlideIds(currentSlideshow.images.map(s => s.imageId));
    setUrlMap({});
    urlMapRef.current = {};
    failedIdsRef.current = new Set();
    setCurrentIndex(0);
    setTransitionClass(`${currentSlideshow.transitionEffect}-in`);
  }, [currentSlideshow]);

  // 预取窗口：当前张优先，其次下一张/上一张；失败的图片记录下来由跳过逻辑处理
  useEffect(() => {
    if (!currentSlideshow || slideIds.length === 0) return;
    let cancelled = false;

    (async () => {
      for (const offset of PRELOAD_WINDOW) {
        const idx = (currentIndex + offset + slideIds.length) % slideIds.length;
        const id = slideIds[idx];
        if (urlMapRef.current[id] || failedIdsRef.current.has(id)) continue;
        try {
          const blob = await imageApi.getById(id);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          createdUrlsRef.current.push(url);
          urlMapRef.current[id] = url;
          setUrlMap(prev => ({ ...prev, [id]: url }));
        } catch {
          if (cancelled) return;
          failedIdsRef.current.add(id);
          setUrlMap(prev => ({ ...prev }));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [currentSlideshow, slideIds, currentIndex]);

  // 当前张加载失败（如图片已被删除）时跳到下一张；全部失败才报错
  useEffect(() => {
    if (slideIds.length === 0) return;
    const currentId = slideIds[currentIndex];
    if (currentId && !failedIdsRef.current.has(currentId)) return;
    if (failedIdsRef.current.size >= slideIds.length) {
      setError('轮播中的图片都已被删除');
      return;
    }
    setCurrentIndex(prev => (prev + 1) % slideIds.length);
  }, [slideIds, currentIndex, urlMap]);

  const goNext = useCallback(() => {
    if (slideIds.length === 0 || transitioningRef.current) return;
    const currentEffect = currentSlideshow?.transitionEffect ?? 'fade';
    transitioningRef.current = true;
    setTransitionClass(`${currentEffect}-out`);
    transitionTimerRef.current = window.setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % slideIds.length);
      setTransitionClass(`${currentEffect}-in`);
      transitioningRef.current = false;
    }, 300);
  }, [slideIds.length, currentSlideshow]);

  const goPrev = useCallback(() => {
    if (slideIds.length === 0 || transitioningRef.current) return;
    const currentEffect = currentSlideshow?.transitionEffect ?? 'fade';
    transitioningRef.current = true;
    setTransitionClass(`${currentEffect}-out`);
    transitionTimerRef.current = window.setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + slideIds.length) % slideIds.length);
      setTransitionClass(`${currentEffect}-in`);
      transitioningRef.current = false;
    }, 300);
  }, [slideIds.length, currentSlideshow]);

  // 自动播放定时器（依赖 goNext，需在 goNext 定义之后）
  useEffect(() => {
    if (!currentSlideshow || !currentSlideshow.autoPlay || !isPlaying || slideIds.length === 0) return;

    const timer = window.setInterval(() => {
      goNext();
    }, currentSlideshow.interval * 1000);

    return () => clearInterval(timer);
  }, [currentSlideshow, isPlaying, slideIds.length, goNext]);

  const getTransitionStyle = (effect: string, className: string) => {
    switch (effect) {
      case 'fade':
        return { opacity: className.includes('out') ? 0 : 1, transition: 'opacity 0.3s ease' };
      case 'slide':
        return {
          transform: className.includes('out') ? 'translateX(100%)' : className.includes('in') ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.5s ease'
        };
      case 'zoom':
        return {
          transform: className.includes('out') ? 'scale(1.2)' : className.includes('in') ? 'scale(1)' : 'scale(0.8)',
          opacity: className.includes('out') ? 0 : 1,
          transition: 'all 0.4s ease'
        };
      case 'flip':
        return {
          transform: className.includes('out') ? 'rotateY(90deg)' : className.includes('in') ? 'rotateY(0)' : 'rotateY(-90deg)',
          opacity: className.includes('out') || !className.includes('in') ? 0 : 1,
          transition: 'all 0.5s ease',
          transformStyle: 'preserve-3d' as const
        };
      case 'blur':
        return {
          filter: className.includes('out') ? 'blur(20px)' : className.includes('in') ? 'blur(0)' : 'blur(20px)',
          opacity: className.includes('out') ? 0 : 1,
          transition: 'all 0.4s ease'
        };
      default:
        return { opacity: className.includes('out') ? 0 : 1, transition: 'opacity 0.3s ease' };
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const reset = () => {
    setCurrentIndex(0);
  };

  const exit = useCallback(() => navigate(-1), [navigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, exit]);

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 text-white/60">
        <p>{error}</p>
        <button
          onClick={exit}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
        >
          返回
        </button>
      </div>
    );
  }

  if (!currentSlideshow || slideIds.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white/50">
        加载中...
      </div>
    );
  }

  const currentId = slideIds[currentIndex];
  const currentUrl = urlMap[currentId];
  const effect = currentSlideshow.transitionEffect;
  const slideData = currentSlideshow.images.find(s => s.imageId === currentId);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Image */}
      <div className="absolute inset-0 flex items-center justify-center">
        {currentUrl ? (
          <img
            src={currentUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
            style={getTransitionStyle(effect, transitionClass)}
          />
        ) : (
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
        )}

        {/* Overlay text */}
        {currentUrl && slideData?.overlayText && (
          <div
            className={`absolute text-white transition-all duration-300 ${transitionClass}`}
            style={{
              ...getOverlayPositionStyle(slideData.textPosition),
              color: slideData.textColor,
              fontSize: `${slideData.textSize}px`,
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              padding: '10px 20px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
            }}
          >
            {slideData.overlayText}
          </div>
        )}
      </div>

      {/* Controls overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center gap-3">
          <div className="text-white/80 font-medium truncate min-w-0">
            {currentSlideshow.name}
          </div>
          <div className="flex items-center gap-2 text-white/80 text-sm shrink-0">
            {currentIndex + 1} / {slideIds.length}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <button onClick={goPrev} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <button onClick={togglePlay} className="w-16 h-16 rounded-full bg-[#E8845C] flex items-center justify-center text-white hover:bg-[#E8845C]/80 transition-colors">
              {isPlaying ? (
                <div className="flex gap-1.5">
                  <div className="w-2 h-8 bg-white rounded" />
                  <div className="w-2 h-8 bg-white rounded" />
                </div>
              ) : (
                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white border-b-[10px] border-b-transparent ml-1" />
              )}
            </button>
            <button onClick={goNext} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 mt-4">
            <button onClick={reset} className="p-2 rounded-full bg-white/10 backdrop-blur-sm text-white/70 hover:text-white hover:bg-white/20 transition-colors">
              <RotateCcw size={20} />
            </button>
          </div>
        </div>

        {/* Side navigation hints */}
        <button onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft size={32} />
        </button>
        <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors">
          <ChevronRight size={32} />
        </button>
      </div>

      {/* Exit hint（移动端没有 ESC 键，不展示） */}
      <div className={`hidden sm:block absolute top-4 right-4 text-white/30 text-sm transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        按 ESC 退出
      </div>
    </div>
  );
}

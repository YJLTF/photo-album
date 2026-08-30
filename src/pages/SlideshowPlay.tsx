import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { slideshowApi, imageApi, type SlideshowWithImages, type SlideshowImageItem } from '@/lib/api';
import { getOverlayPositionStyle } from '@/lib/overlayPosition';

interface PlayableSlide {
  id: string;
  url: string;
}

export default function SlideshowPlay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const slideshowId = params.get('slideshowId');
  const albumId = params.get('albumId');

  const [currentSlideshow, setCurrentSlideshow] = useState<SlideshowWithImages | null>(null);
  const [slides, setSlides] = useState<PlayableSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [error, setError] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [transitionClass, setTransitionClass] = useState('');

  const hideTimerRef = useRef<number | null>(null);
  const effectRef = useRef<string>('fade');

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

  useEffect(() => {
    if (currentSlideshow) {
      effectRef.current = currentSlideshow.transitionEffect;
    }
  }, [currentSlideshow]);

  useEffect(() => {
    let cancelled = false;
    // 本次运行创建的 object URL 统一记录，仅在清理时释放，
    // 不能把 imageUrls state 放进依赖数组（会导致"设置状态→重跑→吊销在显 URL"的死循环）
    const createdUrls: string[] = [];

    const loadImage = async (id: string) => {
      const blob = await imageApi.getById(id);
      const url = URL.createObjectURL(blob);
      createdUrls.push(url);
      return url;
    };

    const fetchData = async () => {
      try {
        if (slideshowId) {
          const slideshow = await slideshowApi.getById(slideshowId);
          // 图片可能已被删除（404），逐张容错跳过而不是让整页卡死
          const results = await Promise.allSettled(
            slideshow.images.map(s => loadImage(s.imageId).then(url => ({ id: s.imageId, url })))
          );
          const playable = results
            .filter((r): r is PromiseFulfilledResult<PlayableSlide> => r.status === 'fulfilled')
            .map(r => r.value);

          if (cancelled) return;
          if (playable.length === 0) {
            setError('轮播中的图片都已被删除');
            return;
          }

          setCurrentSlideshow(slideshow);
          setSlides(playable);
        } else if (albumId) {
          // 轮播按图片处理，相册中的视频不参与（服务端无 ffmpeg 转码，播放节奏与定时器不匹配）
          const albumImages = (await imageApi.getByAlbum(albumId)).items.filter(i => i.type !== "video");
          if (albumImages.length === 0) {
            setError('相册中没有图片');
            return;
          }
          const results = await Promise.allSettled(
            albumImages.map(img => loadImage(img.id).then(url => ({ id: img.id, url })))
          );
          const playable = results
            .filter((r): r is PromiseFulfilledResult<PlayableSlide> => r.status === 'fulfilled')
            .map(r => r.value);

          if (cancelled) return;
          if (playable.length === 0) {
            setError('图片加载失败');
            return;
          }

          setCurrentSlideshow({
            id: 'album',
            name: '相册轮播',
            transitionEffect: 'fade',
            interval: 3,
            autoPlay: true,
            createdAt: new Date().toISOString(),
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
          setSlides(playable);
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
      createdUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [slideshowId, albumId]);

  const goNext = useCallback(() => {
    const currentEffect = effectRef.current;
    setTransitionClass(`${currentEffect}-out`);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % slides.length);
      setTransitionClass(`${currentEffect}-in`);
    }, 300);
  }, [slides.length]);

  const goPrev = useCallback(() => {
    const currentEffect = effectRef.current;
    setTransitionClass(`${currentEffect}-out`);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length);
      setTransitionClass(`${currentEffect}-in`);
    }, 300);
  }, [slides.length]);

  // 自动播放定时器（依赖 goNext，需在 goNext 定义之后）
  useEffect(() => {
    if (!currentSlideshow || !currentSlideshow.autoPlay || !isPlaying || slides.length === 0) return;

    const timer = window.setInterval(() => {
      goNext();
    }, currentSlideshow.interval * 1000);

    return () => clearInterval(timer);
  }, [currentSlideshow, isPlaying, slides.length, goNext]);

  const getTransitionStyle = (effect: string, className: string) => {
    switch (effect) {
      case 'fade':
        return { opacity: className.includes('out') ? 0 : 1, transition: 'opacity 0.3s ease' };
      case 'slide':
        return {
          transform: className.includes('out') ? 'translateX(100%)' : className.includes('in') ? 'translateX(0)' : '-translateX(100%)',
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

  if (!currentSlideshow || slides.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white/50">
        Loading...
      </div>
    );
  }

  const slide = slides[currentIndex];
  const effect = currentSlideshow.transitionEffect;
  const slideData = currentSlideshow.images.find(s => s.imageId === slide.id);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Image */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={slide.url}
          alt=""
          className="max-w-full max-h-full object-contain"
          style={getTransitionStyle(effect, transitionClass)}
        />

        {/* Overlay text */}
        {slideData?.overlayText && (
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
            {currentIndex + 1} / {slides.length}
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

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { slideshowApi, imageApi, albumApi, type SlideshowWithImages, type ImageItem } from '@/lib/api';

export default function SlideshowPlay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const slideshowId = params.get('slideshowId');
  const albumId = params.get('albumId');

  const [currentSlideshow, setCurrentSlideshow] = useState<SlideshowWithImages | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
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
    const fetchData = async () => {
      if (slideshowId) {
        const slideshow = await slideshowApi.getById(slideshowId);
        setCurrentSlideshow(slideshow);
        
        const urls: Record<string, string> = {};
        const imgData: ImageItem[] = [];
        
        for (const slide of slideshow.images) {
          const blob = await imageApi.getById(slide.imageId);
          const url = URL.createObjectURL(blob);
          urls[slide.imageId] = url;
          imgData.push({ id: slide.imageId, albumId: '', name: '', filePath: '', fileSize: 0, width: 0, height: 0, mimeType: '', createdAt: '' });
        }
        
        setImageUrls(urls);
        setImages(imgData);
      } else if (albumId) {
        const albumImages = await imageApi.getByAlbum(albumId);
        const urls: Record<string, string> = {};
        
        for (const img of albumImages) {
          const blob = await imageApi.getById(img.id);
          urls[img.id] = URL.createObjectURL(blob);
        }
        
        setImageUrls(urls);
        setImages(albumImages);
        setCurrentSlideshow({
          id: 'album',
          name: '相册轮播',
          transitionEffect: 'fade',
          interval: 3,
          autoPlay: true,
          createdAt: new Date().toISOString(),
          images: albumImages.map((img, idx) => ({
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
      }
    };

    fetchData();

    return () => {
      Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [slideshowId, albumId, imageUrls]);

  useEffect(() => {
    if (!currentSlideshow || !currentSlideshow.autoPlay || !isPlaying || images.length === 0) return;

    const interval = setInterval(() => {
      goNext();
    }, currentSlideshow.interval * 1000);

    return () => clearInterval(interval);
  }, [currentSlideshow?.interval, currentSlideshow?.autoPlay, isPlaying, images.length]);

  const goNext = useCallback(() => {
    const currentEffect = effectRef.current;
    setTransitionClass(`${currentEffect}-out`);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % images.length);
      setTransitionClass(`${currentEffect}-in`);
    }, 300);
  }, [images.length]);

  const goPrev = useCallback(() => {
    const currentEffect = effectRef.current;
    setTransitionClass(`${currentEffect}-out`);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
      setTransitionClass(`${currentEffect}-in`);
    }, 300);
  }, [images.length]);

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

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const reset = () => {
    setCurrentIndex(0);
  };

  const exit = () => navigate(-1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  if (!currentSlideshow || images.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white/50">
        Loading...
      </div>
    );
  }

  const slide = images[currentIndex];
  const effect = currentSlideshow.transitionEffect;
  const url = imageUrls[slide.id];
  const slideData = currentSlideshow.images.find(s => s.imageId === slide.id);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Image */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={url}
          alt={slide.name}
          className="max-w-full max-h-full object-contain"
          style={getTransitionStyle(effect, transitionClass)}
        />
        
        {/* Overlay text */}
        {slideData?.overlayText && (
          <div
            className={`absolute text-white text-shadow-lg transition-all duration-300 ${transitionClass}`}
            style={{
              position: 'absolute',
              [slideData.textPosition === 'top-left' ? 'top' : slideData.textPosition === 'bottom-left' ? 'bottom' : slideData.textPosition === 'top-center' ? 'top' : slideData.textPosition === 'bottom-center' ? 'bottom' : slideData.textPosition === 'top-right' ? 'top' : slideData.textPosition === 'bottom-right' ? 'bottom' : 'top']: '20px',
              [slideData.textPosition === 'top-left' ? 'left' : slideData.textPosition === 'bottom-left' ? 'left' : slideData.textPosition === 'top-center' ? 'left' : slideData.textPosition === 'bottom-center' ? 'left' : slideData.textPosition === 'top-right' ? 'right' : slideData.textPosition === 'bottom-right' ? 'right' : 'left']: slideData.textPosition.includes('center') ? '50%' : '20px',
              transform: slideData.textPosition.includes('center') ? 'translateX(-50%)' : undefined,
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
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center">
          <div className="text-white/80 font-medium">
            {currentSlideshow.name}
          </div>
          <div className="flex items-center gap-2 text-white/80 text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-center justify-center gap-6">
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
            <button onClick={toggleMute} className="p-2 rounded-full bg-white/10 backdrop-blur-sm text-white/70 hover:text-white hover:bg-white/20 transition-colors">
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
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

      {/* Exit hint */}
      <div className={`absolute top-4 right-4 text-white/30 text-sm transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        按 ESC 退出
      </div>
    </div>
  );
}
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Play, Pause, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useStore, objectUrls } from '@/lib/store';
import { db } from '@/lib/db';
import type { SlideshowImage, TransitionEffect, TextPosition } from '@/lib/types';

const positionClasses: Record<TextPosition, string> = {
  'top-left': 'top-6 left-6',
  'top-center': 'top-6 left-1/2 -translate-x-1/2',
  'top-right': 'top-6 right-6',
  'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  'bottom-left': 'bottom-6 left-6',
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-6 right-6',
};

const transitionEnter: Record<TransitionEffect, string> = {
  fade: 'opacity-100',
  slide: 'opacity-100 translate-x-0',
  zoom: 'opacity-100 scale-100',
  flip: 'opacity-100 rotate-y-0',
  blur: 'opacity-100 blur-0',
};

const transitionExit: Record<TransitionEffect, string> = {
  fade: 'opacity-0',
  slide: 'opacity-0 translate-x-full',
  zoom: 'opacity-0 scale-75',
  flip: 'opacity-0 rotate-y-90',
  blur: 'opacity-0 blur-xl',
};

export default function SlideshowPlay() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slideshowId = searchParams.get('slideshowId');

  const currentSlideshow = useStore((s) => s.currentSlideshow);
  const setCurrentSlideshow = useStore((s) => s.setCurrentSlideshow);
  const fetchSlideshows = useStore((s) => s.fetchSlideshows);

  const [images, setImages] = useState<SlideshowImage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0);

  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const playTimer = useRef<ReturnType<typeof setInterval>>();
  const progressTimer = useRef<ReturnType<typeof setInterval>>();

  // Load slideshow and images
  useEffect(() => {
    if (!slideshowId) return;
    (async () => {
      await fetchSlideshows();
      const slideshow = await db.slideshows.get(slideshowId);
      if (slideshow) setCurrentSlideshow(slideshow);

      const slides = await db.slideshowImages
        .where('slideshowId')
        .equals(slideshowId)
        .sortBy('order');
      setImages(slides);

      const urls: Record<string, string> = {};
      for (const slide of slides) {
        if (!objectUrls.has(slide.imageId)) {
          const img = await db.images.get(slide.imageId);
          if (img) {
            const blob = await db.blobs.get(img.blobKey);
            if (blob) objectUrls.set(slide.imageId, URL.createObjectURL(blob.data));
          }
        }
        const url = objectUrls.get(slide.imageId);
        if (url) urls[slide.imageId] = url;
      }
      setImageUrls(urls);
    })();
  }, [slideshowId, fetchSlideshows, setCurrentSlideshow]);

  // Auto-play
  useEffect(() => {
    if (currentSlideshow) setIsPlaying(currentSlideshow.autoPlay);
  }, [currentSlideshow]);

  const goNext = useCallback(() => {
    if (images.length === 0 || transitioning) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((i) => (i + 1) % images.length);
      setSlideProgress(0);
      setTransitioning(false);
    }, 500);
  }, [images.length, transitioning]);

  const goPrev = useCallback(() => {
    if (images.length === 0 || transitioning) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((i) => (i - 1 + images.length) % images.length);
      setSlideProgress(0);
      setTransitioning(false);
    }, 500);
  }, [images.length, transitioning]);

  // Play timer
  useEffect(() => {
    if (isPlaying && currentSlideshow && images.length > 1) {
      const interval = currentSlideshow.interval * 1000;
      playTimer.current = setInterval(goNext, interval);
      return () => clearInterval(playTimer.current);
    }
  }, [isPlaying, currentSlideshow, images.length, goNext]);

  // Progress timer
  useEffect(() => {
    if (isPlaying && currentSlideshow) {
      const total = currentSlideshow.interval * 1000;
      const step = 50;
      progressTimer.current = setInterval(() => {
        setSlideProgress((p) => {
          const next = p + (step / total) * 100;
          return next >= 100 ? 0 : next;
        });
      }, step);
      return () => clearInterval(progressTimer.current);
    } else {
      setSlideProgress(0);
    }
  }, [isPlaying, currentSlideshow]);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [resetHideTimer]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setIsPlaying((p) => !p); }
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') navigate('/slideshow/edit');
      resetHideTimer();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, navigate, resetHideTimer]);

  const exit = () => navigate('/slideshow/edit');

  if (!currentSlideshow || images.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white/50">
        Loading...
      </div>
    );
  }

  const slide = images[currentIndex];
  const effect = currentSlideshow.transitionEffect;
  const url = imageUrls[slide.imageId];

  return (
    <div
      className="fixed inset-0 bg-[#000000] select-none overflow-hidden"
      onMouseMove={resetHideTimer}
      style={{ perspective: '1200px' }}
    >
      {/* Current image */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transition: 'all 500ms ease-in-out' }}
      >
        <img
          src={url}
          alt=""
          className={`max-w-full max-h-full object-contain transition-all duration-500 ease-in-out
            ${transitioning ? transitionExit[effect] : transitionEnter[effect]}`}
          style={{
            ...(effect === 'flip' ? { transformStyle: 'preserve-3d' } : {}),
            ...(transitioning && effect === 'slide' ? { transform: 'translateX(-100%)' } : {}),
            ...(!transitioning && effect === 'slide' ? { transform: 'translateX(0)' } : {}),
            ...(transitioning && effect === 'flip' ? { transform: 'rotateY(-90deg)' } : {}),
            ...(!transitioning && effect === 'flip' ? { transform: 'rotateY(0)' } : {}),
          }}
          draggable={false}
        />
      </div>

      {/* Text overlay */}
      {slide.overlayText && (
        <div
          className={`absolute ${positionClasses[slide.textPosition]} max-w-[80%] text-center`}
          style={{
            color: slide.textColor || '#ffffff',
            fontSize: `${slide.textSize || 24}px`,
            textShadow: '0 2px 8px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          {slide.overlayText}
        </div>
      )}

      {/* Timer bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
        <div
          className="h-full bg-white/60 transition-all duration-100 ease-linear"
          style={{ width: `${slideProgress}%` }}
        />
      </div>

      {/* Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-center gap-4 pb-8 pt-16 bg-gradient-to-t from-black/80 to-transparent">
          <button
            onClick={goPrev}
            className="p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 text-white transition-colors"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="p-3 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 text-white transition-colors"
          >
            {isPlaying ? <Pause size={28} /> : <Play size={28} />}
          </button>
          <button
            onClick={goNext}
            className="p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 text-white transition-colors"
          >
            <ChevronRight size={28} />
          </button>
        </div>
        <div className="absolute bottom-8 left-8 text-white/60 text-sm backdrop-blur-sm bg-white/5 rounded px-2 py-1">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {/* Exit button */}
      <button
        onClick={exit}
        className={`absolute top-6 right-6 p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 text-white transition-all duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <X size={24} />
      </button>
    </div>
  );
}

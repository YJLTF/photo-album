import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { imageApi, albumApi, type ImageItem } from '@/lib/api';

export default function ImagePreview() {
  const { imageId } = useParams();
  const navigate = useNavigate();
  const imgRef = useRef<HTMLImageElement>(null);

  const [image, setImage] = useState<ImageItem | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [albumImages, setAlbumImages] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showControls, setShowControls] = useState(false);

  const hideTimerRef = useRef<number | null>(null);

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = window.setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    document.addEventListener('mousemove', resetHideTimer);
    return () => {
      document.removeEventListener('mousemove', resetHideTimer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  useEffect(() => {
    const fetchData = async () => {
      if (!imageId) return;

      const [imgData, albums] = await Promise.all([
        imageApi.getById(imageId),
        albumApi.getAll(),
      ]);

      const url = URL.createObjectURL(imgData);
      setImageUrl(url);

      let currentImg: ImageItem | null = null;
      let allImages: ImageItem[] = [];

      for (const album of albums) {
        const imgs = await imageApi.getByAlbum(album.id);
        allImages = [...allImages, ...imgs];
        if (imgs.some(i => i.id === imageId)) {
          currentImg = imgs.find(i => i.id === imageId) || null;
        }
      }

      if (currentImg) {
        setImage(currentImg);
        setAlbumImages(allImages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
        setCurrentIndex(allImages.findIndex(i => i.id === imageId));
      }

      return () => {
        URL.revokeObjectURL(url);
      };
    };

    fetchData();
  }, [imageId]);

  const goNext = async () => {
    const nextIndex = (currentIndex + 1) % albumImages.length;
    setCurrentIndex(nextIndex);
    const nextImg = albumImages[nextIndex];
    const blob = await imageApi.getById(nextImg.id);
    setImageUrl(URL.createObjectURL(blob));
    setImage(nextImg);
  };

  const goPrev = async () => {
    const prevIndex = (currentIndex - 1 + albumImages.length) % albumImages.length;
    setCurrentIndex(prevIndex);
    const prevImg = albumImages[prevIndex];
    const blob = await imageApi.getById(prevImg.id);
    setImageUrl(URL.createObjectURL(blob));
    setImage(prevImg);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => { setScale(1); setRotation(0); };
  const rotate = () => setRotation(prev => (prev + 90) % 360);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = image?.name || 'image.jpg';
    link.click();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') navigate(-1);
      else if (e.key === '+') { e.preventDefault(); zoomIn(); }
      else if (e.key === '-') { e.preventDefault(); zoomOut(); }
      else if (e.key === '0') { e.preventDefault(); resetZoom(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, albumImages, navigate]);

  if (!image || !imageUrl) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white/50">
        Loading...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Image */}
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <img
          ref={imgRef}
          src={imageUrl}
          alt={image.name}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
          }}
        />
      </div>

      {/* Controls */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Top bar */}
        <div className="pointer-events-auto absolute top-0 left-0 right-0 p-4 flex justify-between items-center">
          <div className="text-white/80 text-sm max-w-xs truncate">
            {image.name}
          </div>
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Bottom bar */}
        <div className="pointer-events-auto absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center justify-center gap-4">
            <button onClick={zoomOut} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
              <ZoomOut size={20} />
            </button>
            <button onClick={resetZoom} className="px-4 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">
              {Math.round(scale * 100)}%
            </button>
            <button onClick={zoomIn} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
              <ZoomIn size={20} />
            </button>
            <div className="w-px h-8 bg-white/20 mx-2" />
            <button onClick={rotate} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
              <RotateCw size={20} />
            </button>
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
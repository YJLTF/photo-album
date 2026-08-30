import { Play, Pencil, Trash2 } from "lucide-react";

interface SlideshowCardProps {
  slideshow: { id: string; name: string; imageCount: number; transitionEffect?: string };
  onPlay: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function SlideshowCard({ slideshow, onPlay, onEdit, onDelete }: SlideshowCardProps) {
  return (
    <div className="group relative rounded-2xl bg-[#16213E] border border-white/5 p-4 transition-all duration-300 hover:border-[#E8845C]/30 hover:shadow-[0_0_24px_rgba(232,132,92,0.15)]">
      {/* Play button */}
      <button
        onClick={onPlay}
        className="w-12 h-12 rounded-full bg-[#E8845C]/15 border border-[#E8845C]/30 flex items-center justify-center text-[#E8845C] mx-auto mb-3 hover:bg-[#E8845C] hover:text-white hover:shadow-[0_0_20px_rgba(232,132,92,0.4)] transition-all duration-300"
        title="播放"
        aria-label={`播放 ${slideshow.name}`}
      >
        <Play size={20} fill="currentColor" />
      </button>

      {/* Name */}
      <h3
        className="text-sm font-semibold text-[#F5F0EB] text-center truncate"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {slideshow.name}
      </h3>

      {/* Meta */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="text-xs text-[#F5F0EB]/40" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {slideshow.imageCount} 张图片
        </span>
        {slideshow.transitionEffect && (
          <>
            <span className="text-[#F5F0EB]/20">·</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8845C]/10 text-[#E8845C] border border-[#E8845C]/20">
              {slideshow.transitionEffect}
            </span>
          </>
        )}
      </div>

      {/* Action buttons（触屏没有 hover，移动端常显） */}
      {(onEdit || onDelete) && (
        <div className="flex items-center justify-center gap-2 mt-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
          {onEdit && (
            <button
              onClick={onEdit}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#F5F0EB]/50 hover:bg-[#E8845C] hover:text-white transition-colors"
              title="编辑"
              aria-label="编辑"
            >
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#F5F0EB]/50 hover:bg-red-500 hover:text-white transition-colors"
              title="删除"
              aria-label="删除"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

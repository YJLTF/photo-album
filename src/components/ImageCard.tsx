import { Eye, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageCardProps {
  image: { id: string; url: string; name: string };
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPreview: () => void;
}

export default function ImageCard({ image, selected, onSelect, onDelete, onPreview }: ImageCardProps) {
  return (
    <div className="group relative aspect-square rounded-xl overflow-hidden bg-[#16213E] border border-white/5 cursor-pointer transition-all duration-300 hover:border-[#E8845C]/30 hover:shadow-[0_0_20px_rgba(232,132,92,0.15)]">
      {/* Image */}
      <img
        src={image.url}
        alt={image.name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />

      {/* Selection checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={cn(
          "absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 z-10",
          selected
            ? "bg-[#E8845C] border-[#E8845C] text-white"
            : "border-white/40 bg-black/30 opacity-0 group-hover:opacity-100 hover:border-[#E8845C]"
        )}
      >
        {selected && <Check size={14} strokeWidth={3} />}
      </button>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-[#F5F0EB] hover:bg-[#E8845C] hover:text-white transition-colors"
          title="预览"
        >
          <Eye size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-[#F5F0EB] hover:bg-red-500 hover:text-white transition-colors"
          title="删除"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Name tooltip */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-black/50 backdrop-blur-sm text-xs text-[#F5F0EB] truncate opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {image.name}
      </div>
    </div>
  );
}

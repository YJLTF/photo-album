import { Eye, Trash2, Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageCardProps {
  image: { id: string; url: string; name: string; tags?: Array<{ id: string; name: string; color: string }> };
  onClick: () => void;
  onAddTag?: () => void;
  onRemoveTag?: (tagId: string) => void;
  onDelete?: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  canEdit?: boolean;
}

export default function ImageCard({
  image,
  onClick,
  onAddTag,
  onRemoveTag,
  onDelete,
  isSelected = false,
  onToggleSelect,
  canEdit = true
}: ImageCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative aspect-square rounded-xl overflow-hidden bg-[#16213E] border border-white/5 cursor-pointer transition-all duration-300 hover:border-[#E8845C]/30 hover:shadow-[0_0_20px_rgba(232,132,92,0.15)]"
    >
      {/* Image */}
      <img
        src={image.url}
        alt={image.name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />

      {/* Selection checkbox */}
      {onToggleSelect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className={cn(
            "absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 z-10",
            isSelected
              ? "bg-[#E8845C] border-[#E8845C] text-white"
              : "border-white/40 bg-black/30 opacity-0 group-hover:opacity-100 hover:border-[#E8845C]"
          )}
          aria-label={isSelected ? "取消选择" : "选择图片"}
        >
          {isSelected && <Check size={14} strokeWidth={3} />}
        </button>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-[#F5F0EB] hover:bg-[#E8845C] hover:text-white transition-colors"
          title="预览"
          aria-label="预览"
        >
          <Eye size={16} />
        </button>
        {canEdit && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-[#F5F0EB] hover:bg-red-500 hover:text-white transition-colors"
            title="删除"
            aria-label="删除"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Tags + Add tag button (top-right, no overlap) */}
      <div className="absolute top-2 right-2 flex items-start gap-1 z-10 max-w-full">
        {image.tags && image.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end max-w-[calc(100%-1.75rem)]">
            {image.tags.map((tag) => (
              <span
                key={tag.id}
                onClick={canEdit && onRemoveTag ? (e) => {
                  e.stopPropagation();
                  onRemoveTag(tag.id);
                } : undefined}
                className={cn(
                  "flex items-center gap-0.5 text-[10px] leading-none px-1.5 py-1 rounded-md text-white font-medium tracking-wide shadow-sm",
                  canEdit && onRemoveTag && "cursor-pointer hover:brightness-110"
                )}
                style={{ backgroundColor: tag.color }}
                title={canEdit && onRemoveTag ? "点击移除该标签" : tag.name}
              >
                {tag.name}
                {canEdit && onRemoveTag && <X size={8} className="shrink-0 opacity-70" />}
              </span>
            ))}
          </div>
        )}
        {canEdit && onAddTag && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddTag();
            }}
            className="shrink-0 w-6 h-6 rounded-full bg-[#E8845C]/20 border border-[#E8845C]/40 flex items-center justify-center text-[#E8845C] opacity-0 group-hover:opacity-100 hover:bg-[#E8845C] hover:text-white transition-all"
            title="添加标签"
            aria-label="添加标签"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Name tooltip */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-black/50 backdrop-blur-sm text-xs text-[#F5F0EB] truncate opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {image.name}
      </div>
    </div>
  );
}

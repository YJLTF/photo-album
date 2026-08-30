import { useState } from "react";
import { Eye, Trash2, Check, Plus, X, Play, Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageCardProps {
  image: { id: string; url: string; name: string; tags?: Array<{ id: string; name: string; color: string }> };
  onClick: () => void;
  isVideo?: boolean;
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
  isVideo = false,
  onAddTag,
  onRemoveTag,
  onDelete,
  isSelected = false,
  onToggleSelect,
  canEdit = true
}: ImageCardProps) {
  // 视频没有封面帧（上传时浏览器截取失败）时显示占位图标，而不是裂图
  const [posterMissing, setPosterMissing] = useState(false);

  return (
    <div
      onClick={onClick}
      className="group relative aspect-square rounded-xl overflow-hidden bg-[#16213E] border border-white/5 cursor-pointer transition-all duration-300 hover:border-[#E8845C]/30 hover:shadow-[0_0_20px_rgba(232,132,92,0.15)]"
    >
      {/* Image */}
      {posterMissing ? (
        <div className="w-full h-full flex items-center justify-center text-[#F5F0EB]/20">
          <Film size={36} />
        </div>
      ) : (
        <img
          src={image.url}
          alt={image.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
          onError={() => isVideo && setPosterMissing(true)}
        />
      )}

      {/* Video badge */}
      {isVideo && !posterMissing && (
        <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
          <Play size={13} className="text-white ml-0.5" fill="currentColor" />
        </div>
      )}

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
              // 触屏没有 hover，多选框在移动端常显，桌面仍 hover 后出现
              : "border-white/40 bg-black/30 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:border-[#E8845C]"
          )}
          aria-label={isSelected ? "取消选择" : "选择图片"}
        >
          {isSelected && <Check size={14} strokeWidth={3} />}
        </button>
      )}

      {/* Hover overlay（触屏没有 hover，操作按钮在移动端常显） */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 gap-2">
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
            className="shrink-0 w-6 h-6 rounded-full bg-[#E8845C]/20 border border-[#E8845C]/40 flex items-center justify-center text-[#E8845C] opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-[#E8845C] hover:text-white transition-all"
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

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagPillProps {
  tag: { id: string; name: string; color: string };
  selected?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
}

export default function TagPill({ tag, selected = false, onToggle, onRemove }: TagPillProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "group inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 border",
        selected
          ? "bg-[#E8845C]/20 border-[#E8845C]/50 text-[#E8845C] shadow-[0_0_10px_rgba(232,132,92,0.2)]"
          : "bg-white/5 border-white/10 text-[#F5F0EB]/70 hover:border-white/20 hover:text-[#F5F0EB]",
        "font-sans"
      )}
    >
      {/* Color dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: tag.color }}
      />
      <span>{tag.name}</span>

      {/* Remove button */}
      {onRemove && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[#F5F0EB]/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <X size={10} />
        </span>
      )}
    </button>
  );
}

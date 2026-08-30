import { FolderOpen, Pencil, Trash2, Image, Upload } from "lucide-react";

interface AlbumCardProps {
  album: { id: string; name: string; coverUrl?: string; imageCount: number };
  onEdit?: () => void;
  onDelete?: () => void;
  onUploadCover?: () => void;
  onClick: () => void;
}

export default function AlbumCard({ album, onEdit, onDelete, onUploadCover, onClick }: AlbumCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative rounded-2xl overflow-hidden bg-[#16213E] border border-white/5 cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:border-[#E8845C]/30 hover:shadow-[0_0_24px_rgba(232,132,92,0.15)]"
    >
      {/* Cover image or placeholder */}
      <div className="aspect-[4/3] relative overflow-hidden">
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt={album.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-[#1A1A2E] flex items-center justify-center">
            <FolderOpen size={40} className="text-[#F5F0EB]/15" />
          </div>
        )}

        {/* Hover overlay with action buttons */}
        {(onUploadCover || onEdit || onDelete) && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
            {onUploadCover && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUploadCover();
                }}
                className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-[#F5F0EB] hover:bg-[#5CE8A0] hover:text-white transition-colors"
                title="上传封面"
                aria-label="上传封面"
              >
                <Upload size={15} />
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-[#F5F0EB] hover:bg-[#E8845C] hover:text-white transition-colors"
                title="编辑"
                aria-label="编辑"
              >
                <Pencil size={15} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-[#F5F0EB] hover:bg-red-500 hover:text-white transition-colors"
                title="删除"
                aria-label="删除"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-3">
        <h3
          className="text-sm font-semibold text-[#F5F0EB] truncate"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {album.name}
        </h3>
        <div className="flex items-center gap-1 mt-1 text-[#F5F0EB]/40 text-xs" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <Image size={12} />
          <span>{album.imageCount} 张图片</span>
        </div>
      </div>
    </div>
  );
}

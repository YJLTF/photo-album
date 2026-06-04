import { useState, useRef, useCallback } from "react";
import { Upload, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onUpload: (files: FileList) => void;
  albumId?: string;
}

export default function UploadZone({ onUpload, albumId }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList) => {
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      imageFiles.forEach((file) => {
        setProgress((prev) => ({ ...prev, [file.name]: 0 }));
        let p = 0;
        const interval = setInterval(() => {
          p += Math.random() * 25 + 5;
          if (p >= 100) {
            p = 100;
            clearInterval(interval);
          }
          setProgress((prev) => ({ ...prev, [file.name]: Math.min(p, 100) }));
        }, 200);
      });

      const dt = new DataTransfer();
      imageFiles.forEach((f) => dt.items.add(f));
      onUpload(dt.files);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const progressEntries = Object.entries(progress);

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 py-10 px-6",
          dragOver
            ? "border-[#E8845C] bg-[#E8845C]/10 shadow-[0_0_30px_rgba(232,132,92,0.3)]"
            : "border-white/20 bg-[#1A1A2E]/50 hover:border-[#E8845C]/50 hover:bg-[#E8845C]/5"
        )}
      >
        <div
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300",
            dragOver ? "bg-[#E8845C]/20 text-[#E8845C]" : "bg-white/5 text-[#F5F0EB]/40"
          )}
        >
          {dragOver ? <ImagePlus size={28} /> : <Upload size={28} />}
        </div>
        <div className="text-center">
          <p className="text-[#F5F0EB] text-sm font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {dragOver ? "释放以上传图片" : "点击或拖拽图片到此处"}
          </p>
          <p className="text-[#F5F0EB]/40 text-xs mt-1">支持 JPG、PNG、GIF 等格式</p>
        </div>
        {albumId && (
          <span className="absolute top-3 right-3 text-xs text-[#E8845C]/60 bg-[#E8845C]/10 px-2 py-0.5 rounded-full">
            相册 ID: {albumId}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {/* Progress */}
      {progressEntries.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {progressEntries.map(([name, pct]) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-xs text-[#F5F0EB]/60 truncate max-w-[140px]" title={name}>
                {name}
              </span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#E8845C] rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-[#F5F0EB]/40 w-8 text-right">{Math.round(pct)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

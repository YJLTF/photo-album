import { useState, useRef, useCallback } from "react";
import { Upload, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onUpload: (files: FileList, onFileProgress?: (fileName: string, percent: number) => void) => void | Promise<void>;
  albumId?: string;
  compact?: boolean;
}

export default function UploadZone({ onUpload, albumId, compact }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  // dragenter/dragleave 在经过子元素时会成对触发，用计数避免高亮闪烁
  const dragDepth = useRef(0);

  const handleFiles = useCallback(
    async (files: FileList) => {
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      setProgress(Object.fromEntries(imageFiles.map((f) => [f.name, 1])));

      const dt = new DataTransfer();
      imageFiles.forEach((f) => dt.items.add(f));

      try {
        // 上传进度由父组件通过回调回传（见 imageApi.upload 的 XHR 实现）
        await onUpload(dt.files, (fileName, percent) => {
          // 上传完成（100%）由这里统一置位，避免把"发出请求"误标为完成
          setProgress((prev) => ({ ...prev, [fileName]: Math.min(Math.max(percent, 1), 99) }));
        });
        setProgress((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, 100])));
      } catch {
        setProgress((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, prev[k]])));
      } finally {
        // 短暂展示完成状态后清空进度条
        setTimeout(() => setProgress({}), 1200);
      }
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) handleFiles(e.target.files);
      // 允许连续选择同一个文件再次触发 change
      e.target.value = "";
    },
    [handleFiles]
  );

  const progressEntries = Object.entries(progress);

  return (
    <div className="w-full">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current++;
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragLeave={() => {
          dragDepth.current--;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragOver(false);
          }
        }}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300",
          compact ? "py-6 px-4" : "py-10 px-6",
          dragOver
            ? "border-[#E8845C] bg-[#E8845C]/10 shadow-[0_0_30px_rgba(232,132,92,0.3)]"
            : "border-white/20 bg-[#1A1A2E]/50 hover:border-[#E8845C]/50 hover:bg-[#E8845C]/5"
        )}
      >
        <div
          className={cn(
            "rounded-full flex items-center justify-center transition-all duration-300",
            compact ? "w-10 h-10" : "w-14 h-14",
            dragOver ? "bg-[#E8845C]/20 text-[#E8845C]" : "bg-white/5 text-[#F5F0EB]/40"
          )}
        >
          {dragOver ? <ImagePlus size={compact ? 22 : 28} /> : <Upload size={compact ? 22 : 28} />}
        </div>
        <div className="text-center">
          <p className="text-[#F5F0EB] text-sm font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {dragOver ? "释放以上传图片" : "点击或拖拽图片到此处"}
          </p>
          <p className="text-[#F5F0EB]/40 text-xs mt-1">支持 JPG、PNG、GIF、WebP 等格式，单张最大 20MB</p>
        </div>
        {albumId && (
          <span className="absolute top-3 left-3 text-xs text-[#E8845C]/60 bg-[#E8845C]/10 px-2 py-0.5 rounded-full">
            已选择目标相册
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

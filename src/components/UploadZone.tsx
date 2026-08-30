import { useState, useRef, useCallback } from "react";
import { Upload, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toastStore";

// 与后端 routes/images.ts 的限制保持一致
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

interface UploadZoneProps {
  // 进度回调按 File 对象回传（而非文件名）：同名文件各自的进度互不覆盖
  onUpload: (files: FileList, onFileProgress?: (file: File, percent: number) => void) => void | Promise<void>;
  albumId?: string;
  compact?: boolean;
}

export default function UploadZone({ onUpload, albumId, compact }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [failedKeys, setFailedKeys] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  // dragenter/dragleave 在经过子元素时会成对触发，用计数避免高亮闪烁
  const dragDepth = useRef(0);
  // 进度真实值的镜像，catch 时从这里区分哪些文件没传完
  const progressRef = useRef<Record<string, number>>({});

  const handleFiles = useCallback(
    async (files: FileList) => {
      const mediaFiles = Array.from(files).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
      );
      if (mediaFiles.length === 0) return;

      // 尺寸预检：超限文件直接提示并跳过，不再完整上传后被服务端拒绝
      const oversized = mediaFiles.filter(
        (f) => (f.type.startsWith("video/") ? f.size > MAX_VIDEO_SIZE : f.size > MAX_IMAGE_SIZE)
      );
      const valid = mediaFiles.filter((f) => !oversized.includes(f));
      if (oversized.length > 0) {
        toast.error(
          `${oversized.length} 个文件超过大小限制（图片 ≤ 20MB，视频 ≤ 500MB），已跳过：` +
            oversized.slice(0, 3).map((f) => f.name).join("、") +
            (oversized.length > 3 ? " 等" : "")
        );
      }
      if (valid.length === 0) return;

      // key 带序号，同名文件的进度互不干扰
      const keyOf = new Map<File, string>(valid.map((f, i): [File, string] => [f, `${i}:${f.name}`]));
      progressRef.current = Object.fromEntries(valid.map((f, i) => [`${i}:${f.name}`, 1]));
      setProgress(progressRef.current);
      setFailedKeys(new Set());

      const dt = new DataTransfer();
      valid.forEach((f) => dt.items.add(f));

      let anyFailed = false;
      try {
        // 上传进度由父组件通过回调回传（见 imageApi.upload 的 XHR 实现）
        await onUpload(dt.files, (file, percent) => {
          const key = keyOf.get(file);
          if (!key) return;
          // 上传完成（100%）由父组件在每个文件成功后显式置位
          const clamped = Math.min(Math.max(percent, 1), 100);
          progressRef.current = { ...progressRef.current, [key]: clamped };
          setProgress(progressRef.current);
        });
      } catch {
        anyFailed = true;
        // 没到 100% 的即视为失败：保留进度条并标红，便于看清哪些没传上去
        setFailedKeys(
          new Set(Object.entries(progressRef.current).filter(([, v]) => v < 100).map(([k]) => k))
        );
      } finally {
        // 短暂展示完成/失败状态后清空进度条（有失败时多留一会儿看清红条）
        window.setTimeout(() => {
          progressRef.current = {};
          setProgress({});
          setFailedKeys(new Set());
        }, anyFailed ? 3000 : 1200);
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
          <p className="text-[#F5F0EB] text-sm font-medium font-sans">
            {dragOver ? "释放以上传" : "点击或拖拽图片、视频到此处"}
          </p>
          <p className="text-[#F5F0EB]/40 text-xs mt-1">
            支持 JPG、PNG、GIF、WebP、BMP、AVIF 与 MP4、WebM、MOV、MKV、AVI 等格式，图片最大 20MB，视频最大 500MB
          </p>
        </div>
        {albumId && (
          <span className="absolute top-3 left-3 text-xs text-[#E8845C]/60 bg-[#E8845C]/10 px-2 py-0.5 rounded-full">
            已选择目标相册
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {/* Progress */}
      {progressEntries.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {progressEntries.map(([key, pct]) => {
            const name = key.slice(key.indexOf(":") + 1);
            const failed = failedKeys.has(key);
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-[#F5F0EB]/60 truncate max-w-[140px]" title={name}>
                  {name}
                </span>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      failed ? "bg-red-500" : "bg-[#E8845C]"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={cn("text-xs w-8 text-right", failed ? "text-red-400" : "text-[#F5F0EB]/40")}>
                  {failed ? "失败" : `${Math.round(pct)}%`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

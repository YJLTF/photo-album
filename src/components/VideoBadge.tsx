import { Play } from "lucide-react";

// 网格缩略图上的视频角标：提示点击后将打开视频播放器而不是图片预览
export default function VideoBadge() {
  return (
    <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      <Play size={11} className="text-white ml-0.5" fill="currentColor" />
    </div>
  );
}

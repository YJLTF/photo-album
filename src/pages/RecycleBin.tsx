import { useState, useEffect, useCallback } from "react";
import { Trash2, RotateCcw, FolderOpen, Image as ImageIcon, Film, Timer } from "lucide-react";
import {
  recycleApi,
  getThumbnailUrlWithAuth,
  type RecycleBinAlbum,
  type RecycleBinImage,
} from "@/lib/api";
import { toast } from "@/lib/toastStore";

const formatDeletedAt = (value: string) =>
  new Date(value).toLocaleString("zh-CN", { hour12: false });

// 距自动彻底删除还剩几天；不足一天按"即将"处理
const formatAutoPurge = (value?: string | null) => {
  if (!value) return null;
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return days > 0 ? `${days} 天后自动删除` : "即将自动删除";
};

export default function RecycleBin() {
  const [albums, setAlbums] = useState<RecycleBinAlbum[]>([]);
  const [images, setImages] = useState<RecycleBinImage[]>([]);
  const [autoPurgeDisabled, setAutoPurgeDisabled] = useState(false);
  // 服务端配置的真实保留天数；未启用自动清理时为 null
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBin = useCallback(async () => {
    try {
      const data = await recycleApi.getBin();
      setAlbums(data.albums);
      setImages(data.images);
      setAutoPurgeDisabled(Boolean(data.autoPurgeDisabled));
      setRetentionDays(data.retentionDays ?? null);
    } catch (error) {
      console.error("Failed to load recycle bin:", error);
      toast.error(error instanceof Error ? error.message : "回收站加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBin();
  }, [fetchBin]);

  const handleRestoreAlbum = async (album: RecycleBinAlbum) => {
    try {
      await recycleApi.restoreAlbum(album.id);
      toast.success(`相册「${album.name}」已恢复`);
      fetchBin();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "恢复失败");
    }
  };

  const handleRestoreImage = async (image: RecycleBinImage) => {
    try {
      await recycleApi.restoreImage(image.id);
      toast.success(`图片「${image.name}」已恢复`);
      fetchBin();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "恢复失败");
    }
  };

  const handlePurgeAlbum = async (album: RecycleBinAlbum) => {
    if (!confirm(`彻底删除相册「${album.name}」及其中的 ${album.imageCount} 张图片？此操作不可恢复。`)) return;
    try {
      await recycleApi.purgeAlbum(album.id);
      toast.success("相册已彻底删除");
      fetchBin();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handlePurgeImage = async (image: RecycleBinImage) => {
    if (!confirm(`彻底删除图片「${image.name}」？此操作不可恢复。`)) return;
    try {
      await recycleApi.purgeImage(image.id);
      toast.success("图片已彻底删除");
      fetchBin();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleEmpty = async () => {
    if (!confirm("清空回收站中的所有相册与图片？此操作不可恢复。")) return;
    try {
      await recycleApi.empty();
      toast.success("回收站已清空");
      fetchBin();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "清空失败");
    }
  };

  const empty = albums.length === 0 && images.length === 0;

  return (
    <div className="min-h-screen bg-[#1A1A2E] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#16213E]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-[#F5F0EB] font-display">
                回收站
              </h1>
              <p className="text-sm text-[#F5F0EB]/50 mt-1">
                {autoPurgeDisabled
                  ? "删除的相册与图片可在彻底删除前恢复"
                  : retentionDays
                    ? `删除的内容保留 ${retentionDays} 天，到期自动彻底删除；期间可随时恢复`
                    : "删除的内容保留一段时间，到期自动彻底删除；期间可随时恢复"}
              </p>
            </div>
            {!empty && (
              <button
                onClick={handleEmpty}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 rounded-lg text-sm text-red-400 transition-colors shrink-0"
              >
                <Trash2 size={16} />
                <span>清空回收站</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#F5F0EB]/50">加载中...</div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
              <Trash2 size={48} className="text-[#F5F0EB]/20" />
            </div>
            <h3 className="text-xl font-semibold text-[#F5F0EB] mb-2 font-display">
              回收站是空的
            </h3>
            <p className="text-[#F5F0EB]/50">删除的相册和图片会出现在这里</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* 已删除的相册 */}
            {albums.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 font-display">
                  相册（{albums.length}）
                </h2>
                <div className="space-y-3">
                  {albums.map(album => (
                    <div
                      key={album.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#16213E]/50 border border-white/5"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          <FolderOpen size={22} className="text-[#F5F0EB]/30" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#F5F0EB] truncate">{album.name}</p>
                          <p className="text-xs text-[#F5F0EB]/40 mt-0.5">
                            {album.imageCount} 张图片 · 删除于 {formatDeletedAt(album.deletedAt)}
                            {!autoPurgeDisabled && album.autoPurgeAt && ` · ${formatAutoPurge(album.autoPurgeAt)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                        <button
                          onClick={() => handleRestoreAlbum(album)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-[#5CE8A0]/15 border border-[#5CE8A0]/30 hover:bg-[#5CE8A0]/25 rounded-lg text-sm text-[#5CE8A0] transition-colors"
                        >
                          <RotateCcw size={14} />
                          <span>恢复</span>
                        </button>
                        <button
                          onClick={() => handlePurgeAlbum(album)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 rounded-lg text-sm text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                          <span>彻底删除</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 单独删除的图片 */}
            {images.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 font-display">
                  图片（{images.length}）
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {images.map(image => (
                    <div
                      key={image.id}
                      className="rounded-xl bg-[#16213E]/50 border border-white/5 overflow-hidden"
                    >
                      <div className="aspect-[4/3] bg-[#1A1A2E] flex items-center justify-center relative">
                        {/* 占位图标垫底；缩略图接口对视频返回上传时截取的封面帧，
                            没有封面帧时加载失败会隐藏 <img>，露出占位图标 */}
                        <Film size={32} className="text-[#F5F0EB]/20" />
                        <img
                          src={getThumbnailUrlWithAuth(image.id)}
                          alt={image.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-sm text-[#F5F0EB] truncate flex items-center gap-1.5" title={image.name}>
                          {image.type === "video"
                            ? <Film size={13} className="shrink-0 text-[#F5F0EB]/30" />
                            : <ImageIcon size={13} className="shrink-0 text-[#F5F0EB]/30" />}
                          {image.name}
                        </p>
                        <p className="text-xs text-[#F5F0EB]/40 mt-1 truncate">
                          {image.albumName} · 删除于 {formatDeletedAt(image.deletedAt)}
                        </p>
                        {!autoPurgeDisabled && image.autoPurgeAt && (
                          <p className="text-xs text-[#E8845C]/70 mt-0.5 flex items-center gap-1">
                            <Timer size={11} />
                            {formatAutoPurge(image.autoPurgeAt)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => handleRestoreImage(image)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#5CE8A0]/15 border border-[#5CE8A0]/30 hover:bg-[#5CE8A0]/25 rounded-lg text-xs text-[#5CE8A0] transition-colors"
                          >
                            <RotateCcw size={13} />
                            <span>恢复</span>
                          </button>
                          <button
                            onClick={() => handlePurgeImage(image)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 rounded-lg text-xs text-red-400 transition-colors"
                          >
                            <Trash2 size={13} />
                            <span>彻底删除</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// 在浏览器端为视频截取封面帧：服务端没有 ffmpeg，无法为视频生成缩略图，
// 上传前用 <video> + canvas 抽一帧，随文件一起上传作为网格缩略图。
const POSTER_MAX_EDGE = 640;

export interface VideoMeta {
  poster: Blob | null;
  posterExt: string;
  width: number;
  height: number;
  duration: number;
}

const EMPTY: VideoMeta = { poster: null, posterExt: "", width: 0, height: 0, duration: 0 };

// toBlob 的类型参数只是"建议"，个别浏览器不支持 webp 编码时会按默认 png 编码，
// 因此按 webp -> jpeg -> png 依次尝试，并以实际返回的 blob.type 为准
const CANVAS_TYPES = [
  { mime: "image/webp", ext: ".webp" },
  { mime: "image/jpeg", ext: ".jpg" },
  { mime: "image/png", ext: ".png" },
];

export const extractVideoMeta = (file: File): Promise<VideoMeta> =>
  new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const finish = (result: VideoMeta) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(result);
    };

    // 解码失败 / 卡住时不阻塞上传：最多等 10 秒，超时按无封面处理（网格会显示占位图标）
    const timeout = window.setTimeout(() => finish(EMPTY), 10_000);

    video.muted = true;
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      // 跳过开头黑场：取第 1 秒；更短的取中点
      video.currentTime = duration > 2 ? 1 : duration / 2;
    };
    video.onseeked = () => {
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return finish({ ...EMPTY, duration: video.duration || 0 });

        const scale = Math.min(1, POSTER_MAX_EDGE / Math.max(vw, vh));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(vw * scale);
        canvas.height = Math.round(vh * scale);
        canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);

        const meta = { width: vw, height: vh, duration: video.duration || 0 };
        const attempt = (index: number) => {
          if (index >= CANVAS_TYPES.length) return finish({ poster: null, posterExt: "", ...meta });
          canvas.toBlob(
            blob => {
              if (blob && blob.type === CANVAS_TYPES[index].mime) {
                finish({ poster: blob, posterExt: CANVAS_TYPES[index].ext, ...meta });
              } else {
                attempt(index + 1);
              }
            },
            CANVAS_TYPES[index].mime,
            0.8
          );
        };
        attempt(0);
      } catch {
        finish(EMPTY);
      }
    };
    video.onerror = () => finish(EMPTY);

    video.src = url;
  });

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type TransitionEffect = "fade" | "slide" | "zoom" | "flip" | "blur";

interface TransitionPreviewProps {
  effect: TransitionEffect;
  compact?: boolean;
}

const effectStyles: Record<TransitionEffect, { enter: string; exit: string }> = {
  fade: {
    enter: "animate-[fadeIn_0.6s_ease-in-out_forwards]",
    exit: "animate-[fadeOut_0.6s_ease-in-out_forwards]",
  },
  slide: {
    enter: "animate-[slideIn_0.6s_ease-in-out_forwards]",
    exit: "animate-[slideOut_0.6s_ease-in-out_forwards]",
  },
  zoom: {
    enter: "animate-[zoomIn_0.6s_ease-in-out_forwards]",
    exit: "animate-[zoomOut_0.6s_ease-in-out_forwards]",
  },
  flip: {
    enter: "animate-[flipIn_0.6s_ease-in-out_forwards]",
    exit: "animate-[flipOut_0.6s_ease-in-out_forwards]",
  },
  blur: {
    enter: "animate-[blurIn_0.6s_ease-in-out_forwards]",
    exit: "animate-[blurOut_0.6s_ease-in-out_forwards]",
  },
};

export default function TransitionPreview({ effect, compact }: TransitionPreviewProps) {
  const [showFirst, setShowFirst] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowFirst((prev) => !prev);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const styles = effectStyles[effect];

  if (compact) {
    return (
      <div className="relative w-full h-full">
        <div
          className={cn(
            "absolute inset-0 bg-[#E8845C]/70",
            showFirst ? styles.enter : styles.exit
          )}
        />
        <div
          className={cn(
            "absolute inset-0 bg-[#5C8FE8]/70",
            !showFirst ? styles.enter : styles.exit
          )}
        />
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
          @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-100%); opacity: 0; } }
          @keyframes zoomIn { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes zoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
          @keyframes flipIn { from { transform: rotateY(90deg); opacity: 0; } to { transform: rotateY(0); opacity: 1; } }
          @keyframes flipOut { from { transform: rotateY(0); opacity: 1; } to { transform: rotateY(-90deg); opacity: 0; } }
          @keyframes blurIn { from { filter: blur(8px); opacity: 0; } to { filter: blur(0); opacity: 1; } }
          @keyframes blurOut { from { filter: blur(0); opacity: 1; } to { filter: blur(8px); opacity: 0; } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-[#16213E] border border-white/5">
        <div
          className={cn(
            "absolute inset-0 bg-[#E8845C]/60 rounded-lg",
            showFirst ? styles.enter : styles.exit
          )}
        />
        <div
          className={cn(
            "absolute inset-0 bg-[#5C8FE8]/60 rounded-lg",
            !showFirst ? styles.enter : styles.exit
          )}
        />
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-100%); opacity: 0; } }
        @keyframes zoomIn { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes zoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
        @keyframes flipIn { from { transform: rotateY(90deg); opacity: 0; } to { transform: rotateY(0); opacity: 1; } }
        @keyframes flipOut { from { transform: rotateY(0); opacity: 1; } to { transform: rotateY(-90deg); opacity: 0; } }
        @keyframes blurIn { from { filter: blur(12px); opacity: 0; } to { filter: blur(0); opacity: 1; } }
        @keyframes blurOut { from { filter: blur(0); opacity: 1; } to { filter: blur(12px); opacity: 0; } }
      `}</style>
    </div>
  );
}

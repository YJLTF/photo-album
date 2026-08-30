import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type TransitionEffect = "fade" | "slide" | "zoom" | "flip" | "blur";

interface TransitionPreviewProps {
  effect: TransitionEffect;
  compact?: boolean;
}

// keyframes 统一定义在 index.css，这里只负责拼 class
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
    const timer = window.setInterval(() => {
      setShowFirst((prev) => !prev);
    }, 1500);
    return () => clearInterval(timer);
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
    </div>
  );
}

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeToasts, type ToastItem } from "@/lib/toastStore";

// 全局操作反馈：任意模块调用 lib/toastStore 的 toast.success/error 即可弹出
export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setList), []);

  if (list.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {list.map(t => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-lg backdrop-blur-md text-sm",
            "animate-[toast-in_0.25s_ease-out]",
            t.kind === "success"
              ? "bg-[#16213E]/95 border-[#5CE8A0]/30 text-[#F5F0EB]"
              : "bg-[#2A1520]/95 border-red-500/30 text-[#F5F0EB]"
          )}
          role="status"
        >
          {t.kind === "success"
            ? <CheckCircle2 size={16} className="text-[#5CE8A0] shrink-0" />
            : <XCircle size={16} className="text-red-400 shrink-0" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div
        className={cn(
          "relative w-full max-w-lg mx-4 bg-[#1A1A2E] border border-white/10 rounded-2xl shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2
              className="text-lg font-semibold text-[#F5F0EB]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#F5F0EB]/50 hover:bg-white/10 hover:text-[#F5F0EB] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Close button when no title */}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#F5F0EB]/50 hover:bg-white/10 hover:text-[#F5F0EB] transition-colors z-10"
          >
            <X size={16} />
          </button>
        )}

        {/* Body */}
        <div className="px-6 py-4 text-[#F5F0EB]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

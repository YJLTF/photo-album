import { useState } from "react";
import { Images, Tags, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { key: "albums", label: "相册", icon: <Images size={20} /> },
  { key: "tags", label: "标签", icon: <Tags size={20} /> },
  { key: "slideshows", label: "轮播", icon: <Play size={20} /> },
];

interface SidebarProps {
  activeKey?: string;
  onNavigate?: (key: string) => void;
}

export default function Sidebar({ activeKey = "albums", onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex flex-col h-full bg-[#1A1A2E] border-r border-white/10 transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-6">
        <span className="text-[#E8845C] text-2xl font-bold shrink-0">📷</span>
        {!collapsed && (
          <h1
            className="text-xl font-bold text-[#F5F0EB] whitespace-nowrap"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            光影集
          </h1>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-2 mt-2">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate?.(item.key)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
              activeKey === item.key
                ? "bg-[#E8845C]/20 text-[#E8845C] shadow-[0_0_12px_rgba(232,132,92,0.25)]"
                : "text-[#F5F0EB]/60 hover:bg-white/5 hover:text-[#F5F0EB]"
            )}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span style={{ fontFamily: "'DM Sans', sans-serif" }}>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#16213E] border border-white/10 flex items-center justify-center text-[#F5F0EB]/60 hover:text-[#E8845C] hover:border-[#E8845C]/40 transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
}

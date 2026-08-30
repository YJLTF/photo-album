import { useState } from "react";
import { Images, Tags, Play, ChevronLeft, ChevronRight, LogOut, Key, Camera, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PermissionLevel } from "@/lib/api";
import { PERMISSION_LABELS, PERMISSION_TEXT_COLORS } from "@/lib/constants";

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  requiredPermission?: PermissionLevel;
}

const navItems: NavItem[] = [
  { key: "albums", label: "相册", icon: <Images size={20} /> },
  { key: "tags", label: "标签", icon: <Tags size={20} /> },
  { key: "slideshows", label: "轮播", icon: <Play size={20} /> },
  // 回收站只有能执行删除的编辑者以上权限可见
  { key: "recycle", label: "回收站", icon: <Trash2 size={20} />, requiredPermission: "editor" },
];

const adminNavItems: NavItem[] = [
  { key: "access-keys", label: "访问密钥", icon: <Key size={20} />, requiredPermission: "admin" },
];

interface SidebarProps {
  activeKey?: string;
  onNavigate?: (key: string) => void;
  permission: PermissionLevel;
  onLogout: () => void;
  /** 移动端抽屉模式：占满父容器宽度，隐藏折叠按钮 */
  mobile?: boolean;
}

export default function Sidebar({ activeKey = "albums", onNavigate, permission, onLogout, mobile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const canAccess = (item: NavItem) => {
    if (!item.requiredPermission) return true;
    const permOrder = { viewer: 1, editor: 2, admin: 3 };
    return permOrder[permission] >= permOrder[item.requiredPermission];
  };

  const renderItem = (item: NavItem) => (
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
      {!collapsed && <span className="font-sans">{item.label}</span>}
    </button>
  );

  return (
    <aside
      className={cn(
        "relative flex flex-col h-full bg-[#1A1A2E] border-r border-white/10 transition-all duration-300",
        mobile ? "w-full" : collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-6">
        <Camera size={24} className="text-[#E8845C] shrink-0" />
        {!collapsed && (
          <h1
            className="text-xl font-bold text-[#F5F0EB] whitespace-nowrap font-display"
          >
            光影集
          </h1>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-2 mt-2">
        {navItems.filter(canAccess).map(renderItem)}

        {/* Admin section */}
        {adminNavItems.filter(canAccess).length > 0 && (
          <>
            {!collapsed && (
              <div className="px-3 py-2 mt-2">
                <span className="text-xs text-[#F5F0EB]/30 uppercase tracking-wider">管理</span>
              </div>
            )}
            {adminNavItems.filter(canAccess).map(renderItem)}
          </>
        )}
      </nav>

      {/* User info and logout */}
      <div className="px-2 pb-4">
        <div className={`${collapsed ? "flex justify-center mb-2" : "px-3 py-2 mb-2"}`}>
          {!collapsed && (
            <div className="text-xs">
              <p className="text-[#F5F0EB]/40">权限</p>
              <p className={cn("font-medium", PERMISSION_TEXT_COLORS[permission])}>
                {PERMISSION_LABELS[permission]}
              </p>
            </div>
          )}
          {collapsed && (
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium", PERMISSION_TEXT_COLORS[permission], "bg-white/10")}>
              {PERMISSION_LABELS[permission][0]}
            </div>
          )}
        </div>
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200",
            "text-[#F5F0EB]/60 hover:bg-red-500/20 hover:text-red-400"
          )}
        >
          <span className="shrink-0"><LogOut size={16} /></span>
          {!collapsed && <span className="font-sans">登出</span>}
        </button>
      </div>

      {/* Collapse toggle（移动端抽屉不需要） */}
      {!mobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#16213E] border border-white/10 flex items-center justify-center text-[#F5F0EB]/60 hover:text-[#E8845C] hover:border-[#E8845C]/40 transition-colors z-10"
          aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      )}
    </aside>
  );
}

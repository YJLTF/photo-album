import { useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Menu, Camera } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { PERMISSION_LABELS, PERMISSION_TEXT_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { PermissionLevel } from "@/lib/api";

interface LayoutProps {
  permission: PermissionLevel;
  onLogout: () => void;
}

export default function Layout({ permission, onLogout }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // 移动端抽屉侧栏的开关；桌面端（md+）侧栏常驻，与抽屉互不影响
  const [drawerOpen, setDrawerOpen] = useState(false);

  const getActiveKey = () => {
    if (location.pathname.startsWith("/slideshow")) return "slideshows";
    if (location.pathname.startsWith("/tags")) return "tags";
    if (location.pathname.startsWith("/admin")) return "access-keys";
    if (location.pathname.startsWith("/recycle")) return "recycle";
    if (location.pathname.startsWith("/album")) return "albums";
    return "albums";
  };

  const handleNavigate = (key: string) => {
    switch (key) {
      case "albums":
        navigate("/");
        break;
      case "tags":
        navigate("/tags");
        break;
      case "slideshows":
        // 只读用户进编辑页只能看到一屏禁用的表单；跳回主页并滚动定位到轮播区块
        if (permission === "viewer") {
          navigate("/", { state: { scrollTo: "slideshows" } });
        } else {
          navigate("/slideshow/edit");
        }
        break;
      case "access-keys":
        navigate("/admin/keys");
        break;
      case "recycle":
        navigate("/recycle");
        break;
    }
    // 抽屉里点了导航就顺手收起，避免挡住新页面
    setDrawerOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 桌面侧栏（md 及以上） */}
      <div className="hidden md:block h-full shrink-0">
        <Sidebar activeKey={getActiveKey()} onNavigate={handleNavigate} permission={permission} onLogout={onLogout} />
      </div>

      {/* 移动端抽屉遮罩 */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      {/* 移动端抽屉侧栏 */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 transform transition-transform duration-300 md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar
          activeKey={getActiveKey()}
          onNavigate={handleNavigate}
          permission={permission}
          onLogout={onLogout}
          mobile
        />
      </aside>

      {/* 主内容列：移动端顶部应用栏 + 页面滚动区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-2 h-12 px-3 shrink-0 bg-[#16213E]/90 backdrop-blur-md border-b border-white/5">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-1 rounded-lg text-[#F5F0EB]/80 hover:bg-white/5 hover:text-[#F5F0EB] transition-colors"
            aria-label="打开菜单"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Camera size={18} className="text-[#E8845C] shrink-0" />
            <span className="text-base font-bold text-[#F5F0EB] whitespace-nowrap font-display">
              光影集
            </span>
          </div>
          <span className={cn("text-xs px-2 py-0.5 rounded-full bg-white/5 shrink-0", PERMISSION_TEXT_COLORS[permission])}>
            {PERMISSION_LABELS[permission]}
          </span>
        </header>
        <main className="flex-1 overflow-y-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

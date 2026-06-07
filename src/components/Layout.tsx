import { useNavigate, useLocation } from "react-router-dom";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import type { PermissionLevel } from "@/lib/api";

interface LayoutProps {
  permission: PermissionLevel;
  onLogout: () => void;
}

export default function Layout({ permission, onLogout }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveKey = () => {
    if (location.pathname.startsWith("/slideshow")) return "slideshows";
    if (location.pathname.startsWith("/tags")) return "tags";
    if (location.pathname.startsWith("/admin")) return "access-keys";
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
        navigate("/slideshow/edit");
        break;
      case "access-keys":
        navigate("/admin/keys");
        break;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeKey={getActiveKey()} onNavigate={handleNavigate} permission={permission} onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
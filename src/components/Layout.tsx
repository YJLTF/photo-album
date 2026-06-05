import { useNavigate, useLocation } from "react-router-dom";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveKey = () => {
    if (location.pathname.startsWith("/slideshow")) return "slideshows";
    if (location.pathname.startsWith("/tags")) return "tags";
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
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeKey={getActiveKey()} onNavigate={handleNavigate} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

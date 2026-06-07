import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import AlbumDetail from "@/pages/AlbumDetail";
import ImagePreview from "@/pages/ImagePreview";
import SlideshowEdit from "@/pages/SlideshowEdit";
import SlideshowPlay from "@/pages/SlideshowPlay";
import Tags from "@/pages/Tags";
import AccessKeys from "@/pages/AccessKeys";
import Login from "@/pages/Login";
import { authApi, type PermissionLevel } from "@/lib/api";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [permission, setPermission] = useState<PermissionLevel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedPermission = localStorage.getItem("permission") as PermissionLevel;
    
    if (token && savedPermission) {
      authApi.validate().then(() => {
        setIsAuthenticated(true);
        setPermission(savedPermission);
        setLoading(false);
      }).catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("permission");
        setIsAuthenticated(false);
        setPermission(null);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (_token: string, perm: PermissionLevel) => {
    setIsAuthenticated(true);
    setPermission(perm);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("permission");
    setIsAuthenticated(false);
    setPermission(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A2E]">
        <div className="text-[#F5F0EB]/50">加载中...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Login page */}
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} 
        />

        {/* Redirect to login if not authenticated */}
        <Route 
          path="*" 
          element={isAuthenticated ? null : <Navigate to="/login" />}
        />

        {/* Full-screen pages without sidebar */}
        {isAuthenticated && (
          <>
            <Route path="/preview/:imageId" element={<ImagePreview />} />
            <Route path="/slideshow/play" element={<SlideshowPlay />} />

            {/* Pages with sidebar layout */}
            <Route element={<Layout permission={permission!} onLogout={handleLogout} />}>
              <Route path="/" element={<Home />} />
              <Route path="/album/:albumId" element={<AlbumDetail />} />
              <Route path="/tags" element={<Tags />} />
              <Route path="/slideshow/edit" element={<SlideshowEdit />} />
              <Route path="/admin/keys" element={<AccessKeys />} />
            </Route>
          </>
        )}

        {/* Default redirect */}
        <Route path="/" element={isAuthenticated ? <Home /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}
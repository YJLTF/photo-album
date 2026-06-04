import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import AlbumDetail from "@/pages/AlbumDetail";
import ImagePreview from "@/pages/ImagePreview";
import SlideshowEdit from "@/pages/SlideshowEdit";
import SlideshowPlay from "@/pages/SlideshowPlay";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Full-screen pages without sidebar */}
        <Route path="/preview/:imageId" element={<ImagePreview />} />
        <Route path="/slideshow/play" element={<SlideshowPlay />} />

        {/* Pages with sidebar layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/album/:albumId" element={<AlbumDetail />} />
          <Route path="/slideshow/edit" element={<SlideshowEdit />} />
        </Route>
      </Routes>
    </Router>
  );
}

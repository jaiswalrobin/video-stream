import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { useState, useEffect } from "react";
import VideoCatalogV2 from "./components/VideoCatalogV2";
import VideoPlayerV2 from "./components/VideoPlayer/VideoPlayerV2";
import UploadPage from "./pages/UploadPage";
import "./App.css";

function App() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <BrowserRouter>
      <div className="app">
        <Navigation scrolled={scrolled} />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<VideoCatalogV2 />} />
            <Route path="/watch/:videoId" element={<VideoPlayerV2 />} />
            <Route path="/upload" element={<UploadPage />} />
          </Routes>
        </main>

        <footer className="footer">
          <div className="footer-content">
            <p>©️ 2026 streamclips. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

// Sub-component to dynamically track query parameter active highlights
function Navigation({ scrolled }) {
  const location = useLocation();
  const currentFilter = new URLSearchParams(location.search).get("filter");

  const isActive = (path, filterValue = null) => {
    if (location.pathname !== path) return false;
    return currentFilter === filterValue;
  };

  return (
    <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="nav-container">
        <div className="nav-left">
          <Link to="/" className="netflix-logo">
            streamclips
          </Link>
          <ul className="nav-links">
            <li>
              <Link to="/" className={isActive("/", null) ? "active" : ""}>
                Home
              </Link>
            </li>
            <li>
              <Link
                to="/?filter=series"
                className={isActive("/", "series") ? "active" : ""}
              >
                Series
              </Link>
            </li>
            <li>
              <Link
                to="/?filter=movies"
                className={isActive("/", "movies") ? "active" : ""}
              >
                Movies
              </Link>
            </li>
            <li>
              <Link
                to="/?filter=new"
                className={isActive("/", "new") ? "active" : ""}
              >
                New & Popular
              </Link>
            </li>
          </ul>
        </div>

        <div className="nav-right">
          <Link to="/upload" className="upload-btn">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Upload</span>
          </Link>
          <div className="profile-menu">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
              alt="Profile"
              className="avatar-img"
            />
          </div>
        </div>
      </div>
    </nav>
  );
}

export default App;

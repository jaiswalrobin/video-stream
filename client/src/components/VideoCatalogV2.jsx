import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Hls from "hls.js";
import { getApiUrl, getThumbnailUrl, getManifestUrl } from "../config/env";
import styles from "./VideoCatalogV2.module.css";

const ACCENTS = ["#e50914", "#ffa53d", "#9b5de5", "#00c2d1"];

// Utility to safely encode URLs with spaces or special characters
const safeEncodeUrl = (url) => {
  if (!url) return "";
  try {
    // Encodes characters like spaces, [, ], (, ) while keeping standard URL structure intact
    return encodeURI(url);
  } catch (err) {
    console.error("Error encoding URL:", url, err);
    return url;
  }
};

function VideoCatalog() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [heroVideo, setHeroVideo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = getApiUrl("/api/videos");
      const response = await axios.get(apiUrl, { timeout: 30000 });

      // Transform and sanitize video objects
      const transformedVideos = (response.data || []).map((video) => {
        const rawThumbnail = video.thumbnail || getThumbnailUrl(video.videoId);
        const rawManifest = video.manifestUrl || getManifestUrl(video.videoId);

        return {
          ...video,
          thumbnail: safeEncodeUrl(rawThumbnail),
          manifestUrl: safeEncodeUrl(rawManifest),
        };
      });

      // Robust sorting by createdAt descending (newest timestamp first)
      const sortedVideos = [...transformedVideos].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;

        return timeA - timeB; // Newest first
      });

      setVideos(sortedVideos);

      if (sortedVideos.length > 0) {
        setHeroVideo(sortedVideos[0]); // Sets the latest upload as Hero
      }
    } catch (err) {
      console.error("Error loading video library:", err);
      setError(err.message || "Failed to load video library");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0m 0s";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className={styles.netflixLoading}>
        <div className={styles.netflixSpinner}></div>
        <p>Loading your library...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>⚠️ Error Loading Catalog</h2>
        <p>{error}</p>
        <button className={styles.errorBtn} onClick={loadVideos}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={styles.netflixCatalog}>
      {heroVideo && (
        <HeroSection
          video={heroVideo}
          navigate={navigate}
          accent={ACCENTS[0]}
        />
      )}

      <div className={styles.contentRows}>
        <VideoRow
          title="Trending Now"
          videos={videos.slice(0, 6)}
          formatDuration={formatDuration}
          navigate={navigate}
        />

        {videos.length > 3 && (
          <VideoRow
            title="Continue Watching"
            videos={videos.slice(3, 9)}
            formatDuration={formatDuration}
            navigate={navigate}
          />
        )}

        {videos.length > 6 && (
          <VideoRow
            title="Recently Added"
            videos={videos.slice(6)}
            formatDuration={formatDuration}
            navigate={navigate}
          />
        )}
      </div>
    </div>
  );
}

function HeroSection({ video, navigate, accent }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Toggle Mute / Unmute
  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;

      if (!nextMuted) {
        videoRef.current.volume = 1.0; // Restores audible playback
      }

      setIsMuted(nextMuted);
    }
  };

  useEffect(() => {
    if (!video || !video.manifestUrl) return;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Enforce initial mute for browser autoplay compliance
    videoElement.muted = true;
    videoElement.defaultMuted = true;
    videoElement.volume = 1.0;

    const manifest = video.manifestUrl;

    const attemptNativePlay = () => {
      videoElement.src = manifest;
      videoElement
        .play()
        .then(() => setIsVideoLoaded(true))
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.warn("[Hero] Native playback failed:", err);
          }
        });
    };

    const isHlsSupported = Hls.isSupported();
    const isM3u8 = manifest.includes(".m3u8");

    if (
      isHlsSupported &&
      (isM3u8 || !manifest.match(/\.(mp4|webm|ogg|mov)$/i))
    ) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 10,
      });

      hls.loadSource(manifest);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoElement
          .play()
          .then(() => setIsVideoLoaded(true))
          .catch((err) => {
            if (err.name !== "AbortError") {
              console.warn("[Hero] HLS play failed:", err);
            }
          });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn("[Hero] Fatal HLS error encountered:", data.type);
          hls.destroy();
          hlsRef.current = null;
          attemptNativePlay();
        }
      });

      hlsRef.current = hls;
    } else {
      attemptNativePlay();
    }

    return () => {
      setIsVideoLoaded(false);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [video?.videoId, video?.manifestUrl]);

  return (
    <div className={styles.heroSection}>
      <div className={styles.heroBackdrop}>
        {/* Poster Image */}
        <img src={video.thumbnail} alt={video.title} />

        {/* Hero Background Video Stream */}
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          autoPlay
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: isVideoLoaded ? 1 : 0,
            transition: "opacity 0.8s ease-in-out",
            pointerEvents: "none",
          }}
        />

        <div className={styles.heroGradient}></div>
      </div>

      <div className={styles.heroContent}>
        <h1 className={styles.heroTitle}>
          <span
            className={styles.heroDot}
            style={{ background: accent }}
          ></span>
          {video.title}
        </h1>
        <div className={styles.heroMeta}>
          <span className={styles.matchPill} style={{ background: accent }}>
            98% Match
          </span>
          <span className={styles.year}>
            {video.createdAt
              ? new Date(video.createdAt).getFullYear()
              : new Date().getFullYear()}
          </span>
          <span className={styles.rating}>HD</span>
        </div>
        <p className={styles.heroDescription}>
          Watch your uploaded video in stunning quality. Stream instantly across
          all your devices with fast global CDN delivery.
        </p>

        <div className={styles.heroButtons}>
          <button
            className={styles.playBtn}
            onClick={() =>
              navigate(`/watch/${encodeURIComponent(video.videoId)}`)
            }
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Play
          </button>

          <button className={styles.infoBtn}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            More Info
          </button>

          {/* Sound Toggle Button */}
          {isVideoLoaded && (
            <button
              className={styles.infoBtn}
              onClick={toggleMute}
              style={{ padding: "13px", borderRadius: "50%" }}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M9 9v6a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function VideoRow({ title, videos, formatDuration, navigate }) {
  const rowContentRef = useRef(null);

  const scrollTrack = (direction) => {
    if (rowContentRef.current) {
      const { scrollLeft, clientWidth } = rowContentRef.current;
      const offset =
        direction === "left"
          ? scrollLeft - clientWidth * 0.75
          : scrollLeft + clientWidth * 0.75;
      rowContentRef.current.scrollTo({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className={styles.rowContainer}>
      <h2 className={styles.rowTitle}>{title}</h2>

      <button
        className={`${styles.rowArrow} ${styles.rowArrowLeft}`}
        onClick={() => scrollTrack("left")}
      >
        ‹
      </button>

      <div ref={rowContentRef} className={styles.rowContent}>
        {videos.map((video, index) => (
          <VideoCard
            key={video.videoId}
            video={video}
            index={index}
            formatDuration={formatDuration}
            navigate={navigate}
          />
        ))}
      </div>

      <button
        className={`${styles.rowArrow} ${styles.rowArrowRight}`}
        onClick={() => scrollTrack("right")}
      >
        ›
      </button>
    </div>
  );
}

function VideoCard({ video, index, formatDuration, navigate }) {
  const accent = ACCENTS[index % ACCENTS.length];
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [hasError, setHasError] = useState(false);

  const startPreview = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsPreviewActive(true);
    }, 200);
  };

  const stopPreview = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsPreviewActive(false);
    setHasError(false);
  };

  useEffect(() => {
    if (!isPreviewActive) return;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    videoElement.muted = true;
    videoElement.defaultMuted = true;
    videoElement.volume = 0;

    const manifest = video.manifestUrl;

    if (!manifest) {
      setHasError(true);
      return;
    }

    const attemptNativePlay = () => {
      videoElement.src = manifest;
      videoElement.play().catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("[Card Preview] Play failed:", err);
        }
      });
    };

    const isHlsSupported = Hls.isSupported();
    const isM3u8 = manifest.includes(".m3u8");

    if (
      isHlsSupported &&
      (isM3u8 || !manifest.match(/\.(mp4|webm|ogg|mov)$/i))
    ) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 5,
      });

      hls.loadSource(manifest);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoElement.play().catch((err) => {
          if (err.name !== "AbortError") {
            console.warn("[Card Preview] HLS autoplay failed:", err);
          }
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          hls.destroy();
          hlsRef.current = null;
          attemptNativePlay();
        }
      });

      hlsRef.current = hls;
    } else {
      attemptNativePlay();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isPreviewActive, video.manifestUrl, video.videoId]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  return (
    <div
      data-id={video.videoId}
      className={styles.videoCard}
      style={{ animationDelay: `${index * 50}ms`, "--card-accent": accent }}
      onClick={() => navigate(`/watch/${encodeURIComponent(video.videoId)}`)}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
    >
      <div className={styles.cardThumbnail}>
        <img
          src={video.thumbnail}
          alt={video.title}
          loading="lazy"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {isPreviewActive && !hasError && (
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            autoPlay
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 1,
              pointerEvents: "none",
              backgroundColor: "#000",
            }}
          />
        )}

        <div className={styles.cardOverlay}>
          <div className={styles.cardActions}>
            <button
              className={`${styles.actionBtn} ${styles.play}`}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/watch/${encodeURIComponent(video.videoId)}`);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="black">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </button>

            <button
              className={`${styles.actionBtn} ${styles.info}`}
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
          <div className={styles.cardDuration}>
            {formatDuration(video.duration)}
          </div>
        </div>
      </div>

      <div className={styles.cardInfo}>
        <h3 className={styles.cardTitle}>{video.title}</h3>
        <div className={styles.cardMeta}>
          <span className={styles.matchMini} style={{ color: accent }}>
            98% Match
          </span>
          <span className={styles.durationMini}>
            {formatDuration(video.duration)}
          </span>
        </div>
        <p className={styles.cardTags}>HD • {video.resolution || "1080p"}</p>
      </div>
    </div>
  );
}

export default VideoCatalog;

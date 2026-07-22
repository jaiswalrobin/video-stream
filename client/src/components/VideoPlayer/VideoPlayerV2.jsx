import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Hls from "hls.js";
import "./VideoPlayerV2.css";
import { getManifestUrl, getThumbnailUrl } from "../../config/env";

function VideoPlayer() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Structural Media State
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
  const [autoLevel, setAutoLevel] = useState(null);

  // Custom UI Controller Engine States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  useEffect(() => {
    loadVideo();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [videoId]);

  const loadVideo = async () => {
    try {
      const response = await axios.get(`/api/videos/${videoId}`);
      const videoData = response.data;
      setVideo({
        ...videoData,
        manifestUrl: getManifestUrl(videoData.videoId),
        thumbnail: getThumbnailUrl(videoData.videoId),
      });
      setLoading(false);
    } catch (err) {
      console.error("❌ Error loading video:", err);
      setError("Video not found");
      setLoading(false);
    }
  };

  const getQualityLabel = (bitrate, height) => {
    if (height && height > 0) return `${height}p`;
    const bitrateKbps = Math.round(bitrate / 1000);
    if (bitrateKbps >= 5000) return "1080p";
    if (bitrateKbps >= 2500) return "720p";
    if (bitrateKbps >= 1000) return "480p";
    if (bitrateKbps >= 500) return "360p";
    return `${bitrateKbps}kbps`;
  };

  // Video Events Sync Logic
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current
        .play()
        .catch((e) => console.log("Playback interrupted:", e));
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const handleScrubChange = (e) => {
    const targetTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleVolumeSlider = (e) => {
    const targetVal = parseFloat(e.target.value);
    setVolume(targetVal);
    if (videoRef.current) {
      videoRef.current.volume = targetVal;
      videoRef.current.muted = targetVal === 0;
      setIsMuted(targetVal === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const muteState = !isMuted;
    setIsMuted(muteState);
    videoRef.current.muted = muteState;
    if (!muteState && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  };

  const seek = (seconds) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(
      Math.max(0, videoRef.current.currentTime + seconds),
      duration,
    );
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error entering fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Hide Controls on Inactivity
  const triggerControlsTimeout = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);

    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showQualityMenu) {
        setShowControls(false);
      }
    }, 2500);
  };

  // Global Keyboard Shortcuts Interface
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Avoid firing hotkeys when active inside selection boxes or options
      if (
        document.activeElement.tagName === "SELECT" ||
        document.activeElement.tagName === "INPUT"
      )
        return;

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          handlePlayPause();
          break;
        case "arrowleft":
          e.preventDefault();
          seek(-10);
          break;
        case "arrowright":
          e.preventDefault();
          seek(10);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        default:
          break;
      }
      triggerControlsTimeout();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, duration, isMuted, volume, showQualityMenu]);

  // Fullscreen State Sync Listener
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // core HLS initialization logic
  useEffect(() => {
    if (!video || !videoRef.current) return;

    const videoElement = videoRef.current;
    let hls;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        debug: false,
      });

      hls.loadSource(video.manifestUrl);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        if (data.levels && data.levels.length > 0) {
          const availableLevels = data.levels.map((level, index) => ({
            index,
            height: level.height || 0,
            width: level.width || 0,
            bitrate: Math.round((level.bitrate || 0) / 1000),
            label: getQualityLabel(level.bitrate, level.height),
          }));

          const sorted = [...availableLevels].sort(
            (a, b) => b.height - a.height || b.bitrate - a.bitrate,
          );
          setLevels(sorted);
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setAutoLevel(data.level);
        const t = videoElement.currentTime;
        // eslint-disable-next-line no-self-assign
        videoElement.currentTime = t + 0.001;
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              hlsRef.current = null;
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      videoElement.src = video.manifestUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [video]);

  const handleManualQuality = (index) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
      setCurrentLevel(index);
      setShowQualityMenu(false);
    }
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "00:00";
    const hrs = Math.floor(timeInSeconds / 3600);
    const mins = Math.floor((timeInSeconds % 3600) / 60);
    const secs = Math.floor(timeInSeconds % 60);

    const pad = (num) => String(num).padStart(2, "0");
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const resolvedAutoLabel =
    currentLevel === -1 && autoLevel !== null
      ? levels.find((l) => l.index === autoLevel)?.label
      : null;

  const activeQualityString =
    currentLevel === -1
      ? `Auto${resolvedAutoLabel ? ` (${resolvedAutoLabel})` : ""}`
      : levels.find((l) => l.index === currentLevel)?.label || "Quality";

  if (loading)
    return <div className="loading">Loading cinematic experience...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!video) return null;

  return (
    <div className="video-player-page">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back to Browse
      </button>

      <div
        ref={playerContainerRef}
        className={`video-container ${showControls ? "controls-active" : "controls-hidden"}`}
        onMouseMove={triggerControlsTimeout}
        onMouseLeave={() =>
          isPlaying && !showQualityMenu && setShowControls(false)
        }
      >
        <video
          ref={videoRef}
          className="video-element"
          crossOrigin="anonymous"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onClick={handlePlayPause}
        />

        {/* CUSTOM INTERFACE OVERLAY MATRIX */}
        <div
          className="custom-controls-overlay"
          onClick={(e) => e.target === e.currentTarget && handlePlayPause()}
        >
          {/* Top Back Drawer Panel inside Fullscreen View */}
          {isFullscreen && (
            <div className="fs-top-bar">
              <button className="fs-close-btn" onClick={toggleFullscreen}>
                ‹ Close Player
              </button>
              <span className="fs-title-indicator">{video.title}</span>
            </div>
          )}

          {/* Bottom Control Dock */}
          <div className="controls-dock" onClick={(e) => e.stopPropagation()}>
            {/* Horizontal Linear Track Progress Timeline */}
            <div className="timeline-container">
              <span className="time-stamp">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleScrubChange}
                className="scrub-timeline"
                style={{
                  background: `linear-gradient(to right, #e50914 0%, #e50914 ${
                    (currentTime / (duration || 1)) * 100
                  }%, rgba(255, 255, 255, 0.2) ${
                    (currentTime / (duration || 1)) * 100
                  }%, rgba(255, 255, 255, 0.2) 100%)`,
                }}
              />
              <span className="time-stamp">{formatTime(duration)}</span>
            </div>

            {/* Action Action Controllers Grid */}
            <div className="buttons-row">
              <div className="control-clusterleft">
                {/* Play/Pause Trigger */}
                <button
                  className="ctrl-action-icon"
                  onClick={handlePlayPause}
                  title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                >
                  {isPlaying ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <rect x="6" y="4" width="4" height="16"></rect>
                      <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  )}
                </button>

                {/* Skip Backward 10s */}
                <button
                  className="ctrl-action-icon"
                  onClick={() => seek(-10)}
                  title="Rewind 10s (Left Arrow)"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {/* Smooth clockwise arc */}
                    <path d="M12 3a9 9 0 1 1-6.36 2.64" />
                    {/* Top-centered clean arrowhead */}
                    <polyline points="12 7 12 3 8 3" />
                    {/* High-contrast centered numeric text */}
                    <text
                      x="12"
                      y="15"
                      fontSize="8"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      fontWeight="800"
                      fill="currentColor"
                      stroke="none"
                      textAnchor="middle"
                    >
                      10
                    </text>
                  </svg>
                </button>

                {/* Skip Forward 10s */}
                <button
                  className="ctrl-action-icon"
                  onClick={() => seek(10)}
                  title="Fast Forward 10s (Right Arrow)"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {/* Smooth counter-clockwise arc */}
                    <path d="M12 3a9 9 0 1 0 6.36 2.64" />
                    {/* Top-centered clean arrowhead */}
                    <polyline points="12 7 12 3 16 3" />
                    {/* High-contrast centered numeric text */}
                    <text
                      x="12"
                      y="15"
                      fontSize="8"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      fontWeight="800"
                      fill="currentColor"
                      stroke="none"
                      textAnchor="middle"
                    >
                      10
                    </text>
                  </svg>
                </button>

                {/* Audio Master Track Engine Component */}
                <div className="audio-control-cluster">
                  <button
                    className="ctrl-action-icon"
                    onClick={toggleMute}
                    title="Mute/Unmute (M)"
                  >
                    {isMuted || volume === 0 ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                      </svg>
                    ) : volume < 0.5 ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07" />
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
                        <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
                      </svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeSlider}
                    className="audio-slider-element"
                  />
                </div>
              </div>

              <div className="control-clusterright">
                {/* Cinematic Resolution Dynamic Panel Overlap */}
                {levels.length > 1 && hlsRef.current && (
                  <div className="quality-dropdown-anchor">
                    <button
                      className="quality-trigger-pill"
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                      </svg>
                      {activeQualityString}
                    </button>

                    {showQualityMenu && (
                      <div className="premium-overlay-menu">
                        <div className="menu-header">Streaming Quality</div>
                        <button
                          className={`menu-option-item ${currentLevel === -1 ? "active-item" : ""}`}
                          onClick={() => handleManualQuality(-1)}
                        >
                          Auto{" "}
                          {resolvedAutoLabel ? `• ${resolvedAutoLabel}` : ""}
                        </button>
                        {levels.map((level) => (
                          <button
                            key={level.index}
                            className={`menu-option-item ${currentLevel === level.index ? "active-item" : ""}`}
                            onClick={() => handleManualQuality(level.index)}
                          >
                            {level.label}{" "}
                            <span className="menu-bitrate-tag">
                              {level.bitrate} kbps
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Viewport Fullscreen Switch */}
                <button
                  className="ctrl-action-icon"
                  onClick={toggleFullscreen}
                  title="Fullscreen Toggle (F)"
                >
                  {isFullscreen ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
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
                      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="video-details">
        <h1 className="cinematic-title">{video.title}</h1>
        <div className="video-meta">
          <span className="hd-badge">HD</span>
          <span className="resolution-label">
            {video.resolution || "1080p"}
          </span>
          <span>•</span>
          <span>
            Uploaded{" "}
            {new Date(video.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;

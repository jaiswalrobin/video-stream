import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import UploadButton from "../components/UploadButton";
import UploadProgress from "../components/UploadProgress";
import useMultipartUpload from "../hooks/useMultipartUpload";
import styles from "./UploadPage.module.css";

export default function UploadPage() {
  const { upload, progress, uploading, error } = useMultipartUpload();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [stage, setStage] = useState("idle"); // idle | uploading | success | error
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Auto-hide error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setStage("idle");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    const fileExtension = selectedFile.name.split(".").pop().toLowerCase();

    // Validate file
    const allowedTypes = [
      "video/mp4",
      "video/quicktime",
      "video/x-matroska",
      "video/webm",
    ];
    const allowedExtensions = ["mp4", "mov", "mkv", "webm"];

    // Check if either the MIME type OR the extension is valid
    if (
      !allowedTypes.includes(selectedFile.type) &&
      !allowedExtensions.includes(fileExtension)
    ) {
      alert("Unsupported format. Use MP4, MOV, MKV, or WebM.");
      return;
    }

    if (selectedFile.size > 500 * 1024 * 1024) {
      alert("File too large. Maximum size is 500 MB.");
      return;
    }
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setStage("idle");

    // Extract video metadata
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setVideoMeta({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(selectedFile);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (selectedFile) => {
    try {
      setStage("uploading");
      await upload(selectedFile);
      setStage("success");

      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (err) {
      console.error(err);
      setStage("error");
    }
  };

  const resetUpload = () => {
    setFile(null);
    setPreview(null);
    setVideoMeta(null);
    setStage("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={styles.uploadPage}>
      {/* Cinematic Background */}
      <div className={styles.uploadBg}>
        <div className={styles.bgGradient}></div>
        <div className={styles.bgGrid}></div>
        <div className={`${styles.bgGlow} ${styles.glow1}`}></div>
        <div className={`${styles.bgGlow} ${styles.glow2}`}></div>
      </div>

      <div className={styles.uploadContainer}>
        {/* Header */}
        <div className={styles.uploadHeader}>
          <button className={styles.backBtn} onClick={() => navigate("/")}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Browse
          </button>
          <div className={styles.headerContent}>
            <div className={styles.badge}>NEW RELEASE</div>
            <h1 className={styles.title}>Upload Your Story</h1>
            <p className={styles.subtitle}>
              Share your cinematic masterpiece with the world
            </p>
          </div>
        </div>

        {/* Main Upload Area */}
        <div className={styles.uploadMain}>
          {/* Idle State - Drop Zone */}
          {stage === "idle" && !file && (
            <div
              className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                onChange={(e) => handleFileSelect(e.target.files[0])}
                className={styles.fileInput}
              />

              <div className={styles.dropContent}>
                <div className={styles.uploadIconWrapper}>
                  <div className={styles.uploadIconRing}></div>
                  <svg
                    className={styles.uploadIcon}
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>

                <h2 className={styles.dropTitle}>
                  {dragActive
                    ? "Drop it like it's hot 🔥"
                    : "Drag & Drop Your Video"}
                </h2>
                <p className={styles.dropSubtitle}>
                  or click to browse your files
                </p>

                <div className={styles.formatBadges}>
                  <span className={styles.formatBadge}>MP4</span>
                  <span className={styles.formatBadge}>MOV</span>
                  <span className={styles.formatBadge}>MKV</span>
                  <span className={styles.formatBadge}>WebM</span>
                </div>

                <div className={styles.sizeLimit}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  Maximum file size: 500 MB
                </div>
              </div>
            </div>
          )}

          {/* File Selected - Preview */}
          {stage === "idle" && file && (
            <div className={styles.filePreview}>
              <div className={styles.previewVideoWrapper}>
                <video src={preview} className={styles.previewVideo} controls />
                <div className={styles.previewOverlay}></div>
              </div>

              <div className={styles.fileDetails}>
                <div className={styles.fileInfo}>
                  <h3 className={styles.fileName} title={file.name}>
                    {file.name}
                  </h3>
                  <div className={styles.fileMeta}>
                    <span className={styles.metaTag}>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                      {formatFileSize(file.size)}
                    </span>
                    {videoMeta && (
                      <>
                        <span className={styles.metaTag}>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect
                              x="2"
                              y="3"
                              width="20"
                              height="14"
                              rx="2"
                              ry="2"
                            ></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                          </svg>
                          {videoMeta.width}×{videoMeta.height}
                        </span>
                        <span className={styles.metaTag}>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          {formatDuration(videoMeta.duration)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.fileActions}>
                  <button
                    className={`${styles.actionBtn} ${styles.secondary}`}
                    onClick={resetUpload}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Remove
                  </button>
                  <UploadButton
                    onUpload={handleUpload}
                    file={file}
                    className={`${styles.actionBtn} ${styles.primary}`}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Start Upload
                  </UploadButton>
                </div>
              </div>
            </div>
          )}

          {/* Uploading State */}
          {stage === "uploading" && (
            <div className={styles.uploadProgress}>
              <UploadProgress progress={progress} />
              <div className="progress-info">
                <h3 className="progress-title">Sending to the cloud...</h3>
                <p className="progress-subtitle">
                  Your video is being uploaded securely
                </p>
              </div>
            </div>
          )}

          {/* Success State */}
          {/* Success State */}
          {stage === "success" && (
            <div className={styles.successScreen}>
              <div className={styles.successAnimation}>
                <div className={styles.successCheck}>
                  <svg
                    width="80"
                    height="80"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div className={styles.successRing}></div>
              </div>
              <h2 className={styles.successTitle}>Upload Complete! 🍿</h2>
              <p className={styles.successSubtitle}>
                Your video is being processed and will appear in your library
                shortly.
              </p>
              <button
                className={styles.successBtn}
                onClick={() => navigate("/")}
              >
                Back to Library
              </button>
            </div>
          )}

          {/* Error State */}
          {stage === "error" && (
            <div className={styles.errorScreen}>
              <div className={styles.errorIcon}>
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <h2 className={styles.errorTitle}>Upload Failed</h2>
              <p className={styles.errorSubtitle}>
                {error || "Something went wrong. Please try again."}
              </p>
              <button className={styles.errorBtn} onClick={resetUpload}>
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Features Strip */}
        <div className={styles.featuresStrip}>
          <div className={styles.feature}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <div>
              <div className={styles.featureTitle}>Secure Upload</div>
              <div className={styles.featureDesc}>End-to-end encrypted</div>
            </div>
          </div>
          <div className={styles.feature}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <div>
              <div className={styles.featureTitle}>Lightning Fast</div>
              <div className={styles.featureDesc}>CDN-powered delivery</div>
            </div>
          </div>
          <div className={styles.feature}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <div>
              <div className={styles.featureTitle}>Multi-Quality</div>
              <div className={styles.featureDesc}>Auto 1080p/720p/480p</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

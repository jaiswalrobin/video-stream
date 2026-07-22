const express = require("express");
const cors = require("cors");
const uploadRoutes = require("./routes/upload.routes.js");
const videoRoutes = require("./routes/video.routes.js");

const app = express();

// Restrict CORS to your specific domain for security.
// Even though CloudFront proxies the traffic, best practice to be explicit.
app.use(cors({
  origin: ['https://streamclips.in', 'https://www.streamclips.in'],
  credentials: true // Required for cookies/sessions
}));

app.use(express.json());

// API Routes
app.use("/api/uploads", uploadRoutes);
app.use("/api/videos", videoRoutes);

// Optional: Health check route for monitoring
app.get("/api/health", (req, res) => res.status(200).send("Server is running"));

// ❌ REMOVED: 'fs', 'path', express.static, and the catch-all SPA route.
// CloudFront and S3 now handle all frontend routing and asset delivery!

module.exports = app;
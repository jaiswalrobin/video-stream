const express = require("express");
const cors = require("cors");
const path = require('path');
const uploadRoutes = require("./routes/upload.routes.js");
const videoRoutes = require("./routes/video.routes.js");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/uploads", uploadRoutes);
app.use("/api/videos", videoRoutes);

const fs = require("fs");

// Serve Vite static assets (support both my-react-app/dist and client/dist)
const myReactAppDist = path.join(__dirname, "../../my-react-app/dist");
const clientDist = path.join(__dirname, "../../client/dist");
const clientDistPath = fs.existsSync(myReactAppDist) ? myReactAppDist : clientDist;

app.use(
  express.static(clientDistPath, {
    maxAge: "1y",
    etag: true,
    lastModified: true,
    index: false, // Prevent auto-serving index.html for asset paths
  })
);

app.use((req, res) => {
  const indexPath = path.join(clientDistPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res
      .status(404)
      .send(
        "Frontend build (index.html) not found. Please run 'npm run build' in my-react-app."
      );
  }
});

module.exports = app;
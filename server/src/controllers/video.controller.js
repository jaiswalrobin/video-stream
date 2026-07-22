const videoService = require("../services/videoFetch.service.js");

async function getAllVideos(req, res) {
  try {
    const videos = await videoService.fetchVideos();
    res.json(videos);
  } catch (err) {
    console.error("Error in getAllVideos controller:", err);
    res.status(500).json({ error: err.message });
  }
}

async function getVideoDetails(req, res) {
  try {
    const videoId = req.params.id;
    const video = await videoService.fetchVideoById(videoId);
    res.json(video);
  } catch (err) {
    console.error(`Error in getVideoDetails controller for ID ${req.params.id}:`, err);
    res.status(404).json({ error: "Video not found" });
  }
}

module.exports = {
  getAllVideos,
  getVideoDetails,
};

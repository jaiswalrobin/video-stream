const express = require("express");
const {
  getAllVideos,
  getVideoDetails
} = require("../controllers/video.controller.js");

const router = express.Router();


router.get('/' , getAllVideos)

router.get('/:id' , getVideoDetails)

module.exports = router;
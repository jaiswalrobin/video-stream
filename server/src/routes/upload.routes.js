const express = require("express");

const {
  initiateUpload,
  completeUpload,
} = require("../controllers/upload.controller.js");

const router = express.Router();

router.post("/initiate", initiateUpload);

router.post("/complete", completeUpload);

module.exports = router;

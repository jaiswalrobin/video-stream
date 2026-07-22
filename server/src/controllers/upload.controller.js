const uploadService = require("../services/upload.service.js");

async function initiateUpload(req, res) {
  try {
    const result = await uploadService.initiate(req.body);

    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
}

async function completeUpload(req, res) {
  try {
    const result = await uploadService.complete(req.body);

    res.json(result);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
}

module.exports = {
  initiateUpload,
  completeUpload,
};

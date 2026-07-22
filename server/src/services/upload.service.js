const { randomUUID } = require("crypto");

const {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const { s3 } = require("../config/aws.js");

function getBucket() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("S3_BUCKET environment variable is missing.");
  }
  return bucket;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB — must match client-side chunkFile.js
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

async function initiate(body) {
  const { filename, contentType, size } = body;
  const Bucket = getBucket();

  if (size > 5 * 1024 * 1024 * 1024) {
    throw new Error("Max upload size exceeded");
  }

  const key = `videos/${randomUUID()}/${filename}`;

  // Step 1: Create the multipart upload session
  const createCommand = new CreateMultipartUploadCommand({
    Bucket,
    Key: key,
    ContentType: contentType,
  });

  const { UploadId: uploadId } = await s3.send(createCommand);

  // Step 2: Generate ALL presigned URLs upfront in parallel
  // The client already knows the chunk count (size / CHUNK_SIZE), and we
  // pre-sign every part here so the client never needs to call /presign.
  const totalParts = Math.ceil(size / CHUNK_SIZE);

  const urlPromises = Array.from({ length: totalParts }, (_, i) => {
    const command = new UploadPartCommand({
      Bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: i + 1,
    });
    return getSignedUrl(s3, command, { expiresIn: PRESIGNED_URL_EXPIRY });
  });

  // All signatures are computed in parallel — nearly as fast as signing one
  const urls = await Promise.all(urlPromises);

  return {
    uploadId,
    key,
    urls, // array indexed 0..N-1; urls[i] is the presigned URL for part (i+1)
  };
}

async function complete(body) {
  const { uploadId, key, parts } = body;
  const Bucket = getBucket();

  const command = new CompleteMultipartUploadCommand({
    Bucket,
    Key: key,
    UploadId: uploadId,

    MultipartUpload: {
      Parts: parts,
    },
  });

  await s3.send(command);

  return {
    success: true,
    key,
  };
}

module.exports = {
  initiate,
  complete,
};

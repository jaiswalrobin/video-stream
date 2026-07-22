const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

async function fetchVideos() {
  console.log(`[VideoService] fetchVideos: Listing S3 bucket "${OUTPUT_BUCKET}" with prefix "hls/"`);

  const listCommand = new ListObjectsV2Command({
    Bucket: OUTPUT_BUCKET,
    Prefix: 'hls/',
    Delimiter: '/'
  });

  const listResponse = await s3.send(listCommand);
  const videoFolders = listResponse.CommonPrefixes || [];

  console.log(`[VideoService] fetchVideos: Found ${videoFolders.length} video folder(s)`);

  const videos = [];

  for (const folder of videoFolders) {
    const videoId = folder.Prefix.replace('hls/', '').replace('/', '');

    try {
      console.log(`[VideoService] fetchVideos: Fetching metadata for videoId="${videoId}"`);
      const video = await fetchVideoById(videoId);
      videos.push(video);
      console.log(`[VideoService] fetchVideos: Successfully loaded videoId="${videoId}"`);
    } catch (err) {
      console.warn(`[VideoService] fetchVideos: Skipping videoId="${videoId}" — ${err.message}`);
    }
  }

  // Sort by creation date (newest first)
  const sorted = videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  console.log(`[VideoService] fetchVideos: Returning ${sorted.length} video(s)`);
  return sorted;
}

async function fetchVideoById(videoId) {
  console.log(`[VideoService] fetchVideoById: Fetching metadata from S3 for videoId="${videoId}"`);

  const metaCommand = new GetObjectCommand({
    Bucket: OUTPUT_BUCKET,
    Key: `hls/${videoId}/metadata.json`
  });

  const metaResponse = await s3.send(metaCommand);
  const metadata = JSON.parse(await metaResponse.Body.transformToString());

  console.log(`[VideoService] fetchVideoById: Metadata parsed for videoId="${videoId}" — duration=${metadata.duration_seconds}s, resolution=${metadata.video?.width}x${metadata.video?.height}`);

  return {
    videoId,
    title: videoId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    duration: parseFloat(metadata.duration_seconds),
    resolution: `${metadata.video.width}x${metadata.video.height}`,
    createdAt: metadata.created_at || new Date().toISOString()
  };
}

module.exports = {
  fetchVideos,
  fetchVideoById
};

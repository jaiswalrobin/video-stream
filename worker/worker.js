
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream, createReadStream, mkdirSync, rmSync, existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Configuration from environment variables
const QUEUE_URL = process.env.SQS_QUEUE_URL;
const INPUT_BUCKET = process.env.INPUT_BUCKET;
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const SEGMENT_DURATION = 6; // matches your -hls_time

// Initialize AWS clients
const sqs = new SQSClient({ region: AWS_REGION });
const s3 = new S3Client({ region: AWS_REGION });

// Define quality levels for adaptive streaming
const QUALITIES = [
  { name: '1080p', height: 1080, videoBitrate: '5000k', audioBitrate: '192k' },
  { name: '720p',  height: 720,  videoBitrate: '2800k', audioBitrate: '128k' },
  { name: '480p',  height: 480,  videoBitrate: '1400k', audioBitrate: '96k' },
  { name: '360p',  height: 360,  videoBitrate: '800k',  audioBitrate: '64k' },
];

// Get video dimensions and FPS using a single ffprobe call
async function getVideoInfo(inputPath) {
  const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -of csv=s=x:p=0 "${inputPath}"`;
  const { stdout } = await execAsync(cmd);
  const [width, height, frameRateRaw] = stdout.trim().split('x');
  const [num, den] = frameRateRaw.split('/').map(Number);
  const fps = den ? num / den : num;
  return { width: Number(width), height: Number(height), fps };
}

// Logging helper
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, ...data }));
};

// Download file from S3 to local path
async function downloadFromS3(bucket, key, localPath) {
  log('info', `Downloading s3://${bucket}/${key} -> ${localPath}`);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);
  const writeStream = createWriteStream(localPath);
  await pipeline(response.Body, writeStream);
}

// Upload local file to S3
async function uploadToS3(localPath, bucket, key) {
  log('info', `Uploading ${path.basename(localPath)} -> s3://${bucket}/${key}`);
  const readStream = createReadStream(localPath);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: readStream,
  });
  await s3.send(command);
}

// Recursively upload all files in a directory to S3
async function uploadDirectoryToS3(localDir, bucket, s3Prefix) {
  const files = readdirSync(localDir);

  for (const filename of files) {
    const localPath = path.join(localDir, filename);
    const stat = statSync(localPath);

    if (stat.isDirectory()) {
      await uploadDirectoryToS3(localPath, bucket, `${s3Prefix}/${filename}`);
    } else if (stat.isFile()) {
      const s3Key = `${s3Prefix}/${filename}`;
      await uploadToS3(localPath, bucket, s3Key);
    }
  }
}

// Transcode video into multiple quality levels
async function transcodeVideo(inputPath, outputDir, videoId, videoInfo) {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // ✅ FIX: Reuse videoInfo instead of calling ffprobe again
  const { height: originalHeight, fps } = videoInfo;
  log('info', `Original video height: ${originalHeight}px, fps: ${fps}`, { videoId });

  // Filter qualities to only include those <= original resolution
  const applicableQualities = QUALITIES.filter(q => q.height <= originalHeight);

  if (applicableQualities.length === 0) {
    applicableQualities.push(QUALITIES[QUALITIES.length - 1]);
  }

  log('info', `Transcoding to qualities: ${applicableQualities.map(q => q.name).join(', ')}`, { videoId });

  for (const q of applicableQualities) {
    const qDir = path.join(outputDir, q.name);
    mkdirSync(qDir, { recursive: true });
  }

  for (const q of applicableQualities) {
    const qDir = path.join(outputDir, q.name);

    // ✅ FIX: Calculate GOP size dynamically based on real FPS
    const gopSize = Math.round(SEGMENT_DURATION * fps);

    const ffmpegCmd = [
      'ffmpeg', '-y', '-i', `"${inputPath}"`,
      '-vf', `"scale=-2:${q.height}"`,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-b:v', q.videoBitrate,
      '-g', `${gopSize}`,
      '-keyint_min', `${gopSize}`,
      '-sc_threshold', '0',
      '-force_key_frames', `"expr:gte(t,n_forced*${SEGMENT_DURATION})"`,
      '-c:a', 'aac', '-b:a', q.audioBitrate,
      '-hls_time', `${SEGMENT_DURATION}`,
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', `"${qDir}/segment_%03d.ts"`,
      `"${qDir}/playlist.m3u8"`
    ].join(' ');

    log('info', `Transcoding ${q.name}...`, { videoId });

    try {
      await execAsync(ffmpegCmd);
      log('info', `✅ ${q.name} complete`, { videoId });
    } catch (err) {
      log('error', `❌ ${q.name} failed`, { videoId, error: err.message });
      throw err;
    }
  }

  const masterPlaylist = generateMasterPlaylist(applicableQualities);
  writeFileSync(path.join(outputDir, 'master.m3u8'), masterPlaylist);
  log('info', `Master playlist generated`, { videoId });

  return true;
}

// Generate master.m3u8 playlist that references all quality levels
function generateMasterPlaylist(qualities) {
  let playlist = '#EXTM3U\n';
  playlist += '#EXT-X-VERSION:3\n';

  for (const q of qualities) {
    const videoBandwidth = parseInt(q.videoBitrate.replace('k', '')) * 1000;
    const audioBandwidth = parseInt(q.audioBitrate.replace('k', '')) * 1000;
    const totalBandwidth = videoBandwidth + audioBandwidth;

    playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${totalBandwidth},RESOLUTION=-1x${q.height},NAME="${q.name}"\n`;
    playlist += `${q.name}/playlist.m3u8\n`;
  }

  return playlist;
}

// Extract video metadata using ffprobe
async function extractMetadata(inputPath) {
  const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`;
  const { stdout } = await execAsync(cmd);
  const data = JSON.parse(stdout);

  const format = data.format || {};
  const videoStream = (data.streams || []).find(s => s.codec_type === 'video') || {};
  const audioStream = (data.streams || []).find(s => s.codec_type === 'audio') || {};

  return {
    duration_seconds: parseFloat(format.duration || 0).toFixed(2),
    file_size_mb: (parseInt(format.size || 0) / (1024 * 1024)).toFixed(2),
    format: format.format_name,
    video: {
      codec: videoStream.codec_name,
      width: parseInt(videoStream.width || 0),
      height: parseInt(videoStream.height || 0),
      frame_rate: videoStream.r_frame_rate,
    },
    audio: {
      codec: audioStream.codec_name,
      channels: parseInt(audioStream.channels || 0),
      sample_rate: audioStream.sample_rate,
    },
  };
}

// Process a single SQS message
async function processMessage(message) {
  const body = JSON.parse(message.Body);

  let bucket, key;
  if (body.Records && body.Records[0]) {
    bucket = body.Records[0].s3.bucket.name;
    key = decodeURIComponent(body.Records[0].s3.object.key.replace(/\+/g, ' '));
  } else {
    log('error', 'Unknown message format', { body });
    return false;
  }

  const ext = path.extname(key);
  const videoId = path.basename(key, ext);
  const localInput = path.join(os.tmpdir(), `${videoId}_input${ext}`);
  const outputDir = path.join(os.tmpdir(), `${videoId}_output`);

  log('info', `🎬 Processing video`, { videoId, key });

  try {
    // 1. Download raw video
    await downloadFromS3(bucket, key, localInput);

    // ✅ FIX: Use localInput instead of undefined inputPath
    const videoInfo = await getVideoInfo(localInput);
    log('info', `Video info: ${videoInfo.width}x${videoInfo.height} @ ${videoInfo.fps}fps`, { videoId });

    // 2. Extract metadata
    log('info', `🔍 Extracting metadata`, { videoId });
    const metadata = await extractMetadata(localInput);

    // ✅ FIX: Pass the whole videoInfo object to transcodeVideo
    await transcodeVideo(localInput, outputDir, videoId, videoInfo);

    // 3. Generate thumbnail at 10% of video duration
    try {
      const duration = parseFloat(metadata.duration_seconds);
      const thumbTime = (duration * 0.1).toFixed(2);

      const thumbCmd = `ffmpeg -y -ss ${thumbTime} -i "${localInput}" -vframes 1 -q:v 2 "${outputDir}/thumbnail.jpg"`;
      await execAsync(thumbCmd);
      log('info', `Thumbnail generated`, { videoId, thumbTime });
    } catch (err) {
      log('warn', `Thumbnail generation failed`, { videoId, error: err.message });
    }

    // 4. Save metadata.json
    writeFileSync(path.join(outputDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

    // 5. Upload ALL output files (including subdirectories) to S3
    log('info', `Uploading all files to S3`, { videoId });
    await uploadDirectoryToS3(outputDir, OUTPUT_BUCKET, `hls/${videoId}`);

    // 6. Delete message from SQS (acknowledge success)
    await sqs.send(new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: message.ReceiptHandle,
    }));

    log('info', `✅ Success`, { videoId });
    return true;

  } catch (err) {
    log('error', `❌ Failed`, { videoId, error: err.message, stack: err.stack });
    return false;

  } finally {
    try {
      if (existsSync(localInput)) rmSync(localInput, { force: true });
      if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      log('warn', `Cleanup failed`, { error: cleanupErr.message });
    }
  }
}

// Main polling loop
async function main() {
  log('info', `🚀 Worker started (Multi-Quality Mode)`, {
    queue: QUEUE_URL,
    input: INPUT_BUCKET,
    output: OUTPUT_BUCKET,
    qualities: QUALITIES.map(q => q.name).join(', ')
  });

  while (true) {
    try {
      const response = await sqs.send(new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 1800,
      }));

      const messages = response.Messages || [];
      if (messages.length > 0) {
        log('info', `Received ${messages.length} message(s)`);
        for (const message of messages) {
          await processMessage(message);
        }
      }
    } catch (err) {
      log('error', `Error in main loop`, { error: err.message });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down');
  process.exit(0);
});

// Start the worker
main().catch(err => {
  log('error', 'Fatal error', { error: err.message });
  process.exit(1);
});
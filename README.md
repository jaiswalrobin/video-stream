# video-stream

Upload a video, watch it back as adaptive HLS — a mini YouTube pipeline.
Raw uploads go to S3, a background worker transcodes them into 4 quality
levels (360p / 480p / 720p / 1080p), and a React player streams them via
CloudFront with automatic quality switching.

## How it works

```
client ──POST /api/uploads/initiate──▶ server returns presigned URLs (5 MB chunks)
client ──multipart upload──▶ S3 input bucket ──ObjectCreated event──▶ SQS ──▶ worker
worker ──ffmpeg transcode──▶ HLS segments ──▶ S3 output bucket ──▶ CloudFront
client ◀── master.m3u8 + segments (hls.js) ── CloudFront
```

| Part | Stack | Job |
|---|---|---|
| `client/` | React 19, Vite, hls.js, react-router | Upload page + video player |
| `server/` | Express, S3 presigned URLs | Issues upload URLs (`/api/uploads`), serves video metadata (`/api/videos`) |
| `worker/` | Node, SQS, S3, ffmpeg/ffprobe | Transcodes each upload into 4 HLS quality levels (6s segments) |

## Prerequisites

- Node.js 18+
- ffmpeg + ffprobe on PATH (worker only, e.g. `brew install ffmpeg`)
- AWS account with: 2 S3 buckets (input + output), 1 SQS queue,
  a CloudFront distribution in front of the output bucket,
  and credentials with S3/SQS access
- S3 event notification on the input bucket sending ObjectCreated events to the queue

## Run it

Each part has an `.env.example` — copy it to `.env` and fill in your values.

```bash
# 1. Server (default port 80, override with PORT)
cd server && npm install && cp .env.example .env
npm run dev

# 2. Worker (new terminal; needs ffmpeg installed)
cd worker && npm install && cp .env.example .env
npm start

# 3. Client (new terminal)
cd client && npm install && cp .env.example .env
npm run dev
```

Then open the client URL, upload a video, wait for the worker to finish
transcoding, and press play.

Note: the server's CORS list in `server/src/app.js` only allows the
production domain. For local dev, add `http://localhost:<vite-port>`
to the `origin` array.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/uploads/initiate` | Start multipart upload, get presigned URLs for all 5 MB chunks (max 5 GB) |
| POST | `/api/uploads/complete` | Finish multipart upload (S3 event → SQS then triggers the worker) |
| GET | `/api/videos` | List all videos |
| GET | `/api/videos/:id` | Video details + playback URLs |
| GET | `/api/health` | Health check |

## Limits / next steps

- Worker handles one video at a time per process; scale by running more workers.
- No auth yet — anyone with the URLs can upload and watch.
- Transcode speed depends on the machine running the worker.

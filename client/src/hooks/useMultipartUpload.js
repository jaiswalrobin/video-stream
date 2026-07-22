import { useState } from "react";
import axios from "axios";
import { initiateUpload, completeUpload } from "../api/uploadApi";
import { chunkFile } from "../utils/chunkFile";

const MAX_CONCURRENT = 5;

export default function useMultipartUpload() {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function upload(file) {
    setUploading(true);

    // Step 1: Create upload session + get ALL presigned URLs in one call
    const { data } = await initiateUpload({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });

    const { uploadId, key, urls } = data;

    const chunks = chunkFile(file);

    const uploadedParts = [];
    let uploadedBytes = 0;
    let currentIndex = 0;

    async function worker() {
      while (currentIndex < chunks.length) {
        const index = currentIndex++;
        const chunk = chunks[index];
        const partNumber = index + 1;

        // Use the presigned URL returned by /initiate — no extra server call
        const response = await axios.put(urls[index], chunk, {
          headers: {
            "Content-Type": "application/octet-stream",
          },
        });

        uploadedBytes += chunk.size;

        setProgress(Math.floor((uploadedBytes / file.size) * 100));

        uploadedParts.push({
          ETag: response.headers.etag,
          PartNumber: partNumber,
        });
      }
    }

    const workers = [];

    for (let i = 0; i < MAX_CONCURRENT; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);

    // Step 2: Complete the upload
    await completeUpload({
      uploadId,
      key,
      parts: uploadedParts,
    });

    setUploading(false);

    return true;
  }

  return {
    upload,
    progress,
    uploading,
  };
}


export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

export function chunkFile(file) {
    const chunks = [];

    let start = 0;

    while (start < file.size) {
        const end = Math.min(start + CHUNK_SIZE, file.size);

        chunks.push(file.slice(start, end));

        start = end;
    }

    return chunks;
}
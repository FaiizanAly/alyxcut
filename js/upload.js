// AlyxCut Video Upload, Validation, and Eager In-Memory Loader
// Prevents NotReadableError by eagerly reading video bytes into memory upon selection

const SUPPORTED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];
const LARGE_FILE_THRESHOLD_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5 GB memory advisory limit

/**
 * Validates a user-selected video file
 * @param {File} file
 * @returns {{ valid: boolean, error?: string, warning?: string }}
 */
export function validateVideoFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const name = file.name.toLowerCase();
  const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const isVideoMime = file.type.startsWith('video/') || file.type === '';

  if (!hasValidExt && !isVideoMime) {
    return {
      valid: false,
      error: `Unsupported file format (${file.name}). Please upload MP4, MOV, WebM, MKV, or AVI videos.`,
    };
  }

  let warning = null;
  if (file.size > LARGE_FILE_THRESHOLD_BYTES) {
    const sizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(1);
    warning = `Large video detected (${sizeGB} GB). Browser memory is limited; processing may take longer on laptops or lower-spec computers.`;
  }

  return { valid: true, warning };
}

/**
 * Formats bytes to human-readable size
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formats seconds into MM:SS or HH:MM:SS
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const mStr = String(mins).padStart(2, '0');
  const sStr = String(secs).padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

/**
 * Eagerly reads file bytes into memory to eliminate stale disk handle NotReadableErrors
 * @param {File} file
 * @param {Function} [onProgress]
 * @returns {Promise<{ arrayBuffer: ArrayBuffer, bytes: Uint8Array, inMemoryBlob: Blob, name: string, size: number, type: string }>}
 */
export async function readVideoFileEagerly(file, onProgress = null) {
  if (!file) throw new Error('No video file provided.');

  if (onProgress) onProgress({ percent: 10, message: 'Reading video bytes into memory...' });

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const inMemoryBlob = new Blob([bytes], { type: file.type || 'video/mp4' });

    if (onProgress) onProgress({ percent: 100, message: 'Video bytes successfully buffered in memory.' });

    return {
      arrayBuffer,
      bytes,
      inMemoryBlob,
      name: file.name,
      size: file.size,
      type: file.type || 'video/mp4',
    };
  } catch (err) {
    console.error('Eager file read error:', err);
    if (err.name === 'NotReadableError' || (err.message && err.message.includes('permission problems'))) {
      throw new Error(
        'Could not read the video file. If the file is inside a OneDrive/cloud-synced folder or open in another media player, copy it to a local folder (like C:\\Videos) and try again.'
      );
    }
    throw new Error(`Failed to read video file "${file.name}": ${err.message || 'Permission denied or file locked.'}`);
  }
}

/**
 * Extracts complete metadata from an in-memory Blob or object URL for preview
 * @param {Blob|File} sourceBlob - In-memory blob or file
 * @param {string} fileName - File name
 * @param {HTMLVideoElement} previewVideoElement
 * @returns {Promise<object>}
 */
export function loadVideoMetadata(sourceBlob, fileName, previewVideoElement) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(sourceBlob);

    const onLoadedMetadata = () => {
      previewVideoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      previewVideoElement.removeEventListener('error', onError);

      const width = previewVideoElement.videoWidth || 1920;
      const height = previewVideoElement.videoHeight || 1080;
      const duration = previewVideoElement.duration || 0;
      const aspect = (width / height).toFixed(2);
      const aspectLabel = aspect === '1.78' ? '16:9' : aspect === '0.56' ? '9:16' : aspect === '1.00' ? '1:1' : `${aspect}:1`;

      resolve({
        name: fileName || 'video.mp4',
        sizeBytes: sourceBlob.size || 0,
        sizeFormatted: formatBytes(sourceBlob.size || 0),
        durationSec: duration,
        durationFormatted: formatDuration(duration),
        width,
        height,
        resolution: `${width} × ${height}`,
        aspectRatio: aspectLabel,
        type: sourceBlob.type || 'video/mp4',
        objectUrl,
      });
    };

    const onError = () => {
      previewVideoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      previewVideoElement.removeEventListener('error', onError);
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to decode video "${fileName}". The video codec may not be supported by your browser.`));
    };

    previewVideoElement.addEventListener('loadedmetadata', onLoadedMetadata);
    previewVideoElement.addEventListener('error', onError);
    previewVideoElement.src = objectUrl;
    previewVideoElement.load();
  });
}

export default {
  validateVideoFile,
  formatBytes,
  formatDuration,
  readVideoFileEagerly,
  loadVideoMetadata,
};

// AlyxCut Video Upload and Validation Module
// Handles drag-and-drop, metadata extraction, validation, and browser memory advisory

const SUPPORTED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];
const LARGE_FILE_THRESHOLD_BYTES = 1024 * 1024 * 1024; // 1 GB warning limit for browser memory

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
 * Extracts complete metadata and creates an object URL for preview
 * @param {File} file
 * @param {HTMLVideoElement} previewVideoElement
 * @returns {Promise<object>}
 */
export function loadVideoMetadata(file, previewVideoElement) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);

    const onLoadedMetadata = () => {
      previewVideoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      previewVideoElement.removeEventListener('error', onError);

      const width = previewVideoElement.videoWidth || 1920;
      const height = previewVideoElement.videoHeight || 1080;
      const duration = previewVideoElement.duration || 0;
      const aspect = (width / height).toFixed(2);
      const aspectLabel = aspect === '1.78' ? '16:9' : aspect === '0.56' ? '9:16' : aspect === '1.00' ? '1:1' : `${aspect}:1`;

      resolve({
        file,
        name: file.name,
        sizeBytes: file.size,
        sizeFormatted: formatBytes(file.size),
        durationSec: duration,
        durationFormatted: formatDuration(duration),
        width,
        height,
        resolution: `${width} × ${height}`,
        aspectRatio: aspectLabel,
        type: file.type || 'video/unknown',
        objectUrl,
      });
    };

    const onError = () => {
      previewVideoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      previewVideoElement.removeEventListener('error', onError);
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to decode video "${file.name}". The video codec may not be supported by your browser.`));
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
  loadVideoMetadata,
};

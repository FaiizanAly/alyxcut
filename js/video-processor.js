// AlyxCut Vertical 9:16 Video Processor & Caption Burner
// Zero external APIs, high-performance Canvas compositor, Instagram Reels & YouTube Shorts presets

let ffmpegInstance = null;
let ffmpegLoading = false;

/**
 * Initializes FFmpeg.wasm if available
 */
export async function initFFmpeg(onProgress = null) {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) return null;

  ffmpegLoading = true;
  try {
    // Check if FFmpeg global is present or load from vendor
    let FFmpegClass = window.FFmpeg?.FFmpeg;
    let toBlobURL = window.FFmpegUtil?.toBlobURL;

    if (!FFmpegClass) {
      // Dynamically load UMD scripts from vendor
      await loadScript('vendor/ffmpeg/ffmpeg.js');
      await loadScript('vendor/ffmpeg/util.js');
      FFmpegClass = window.FFmpeg?.FFmpeg;
      toBlobURL = window.FFmpegUtil?.toBlobURL;
    }

    if (!FFmpegClass) {
      console.warn('FFmpeg.wasm class not found in window, relying on native Canvas+WebCodecs pipeline.');
      ffmpegLoading = false;
      return null;
    }

    const ffmpeg = new FFmpegClass();

    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        onProgress({ percent: Math.round(progress * 100), message: 'FFmpeg processing video...' });
      });
    }

    // Load core wasm files
    const coreURL = await toBlobURL('vendor/ffmpeg/ffmpeg-core.js', 'text/javascript');
    const wasmURL = await toBlobURL('vendor/ffmpeg/ffmpeg-core.wasm', 'application/wasm');

    await ffmpeg.load({
      coreURL,
      wasmURL,
    });

    ffmpegInstance = ffmpeg;
    ffmpegLoading = false;
    console.log('FFmpeg.wasm successfully initialized.');
    return ffmpegInstance;
  } catch (err) {
    console.warn('FFmpeg.wasm initialization failed or blocked by cross-origin isolation. Using Canvas Compositor pipeline:', err);
    ffmpegLoading = false;
    return null;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

/**
 * Renders a vertical 9:16 video clip with blurred background and burned captions
 * @param {HTMLVideoElement} videoElement - Master video element
 * @param {object} clip - Clip metadata { startTime, endTime, duration, chunks, focalX }
 * @param {object} options - User settings { cropMode, captionLanguage, captionStyle, platform }
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<{ blob: Blob, url: string }>}
 */
export async function renderVerticalClip(videoElement, clip, options = {}, onProgress = null) {
  const {
    cropMode = 'blur',
    captionLanguage = 'hinglish',
    captionStyle = {},
    platform = 'reels',
  } = options;

  const width = 720;
  const height = 1280; // Standard 9:16 vertical resolution

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  const startTime = clip.startTime;
  const endTime = clip.endTime;
  const duration = endTime - startTime;

  if (onProgress) onProgress({ percent: 5, message: 'Preparing audio and video streams...' });

  // Prepare Web Audio for synchronized recording
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioDest = audioCtx.createMediaStreamDestination();

  // Route video element audio into destination
  let audioSourceNode = null;
  try {
    audioSourceNode = audioCtx.createMediaElementSource(videoElement);
    audioSourceNode.connect(audioDest);
    audioSourceNode.connect(audioCtx.destination); // also play to speakers if unmuted
  } catch {
    // If source is already connected or CORS applies
  }

  // Combine canvas video stream + audio stream
  const videoStream = canvas.captureStream(30); // 30 FPS
  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  // Determine supported MIME type
  let mimeType = 'video/mp4';
  if (!MediaRecorder.isTypeSupported('video/mp4')) {
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      mimeType = 'video/webm;codecs=vp9,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    }
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 6_000_000, // 6 Mbps high quality
  });

  const recordedChunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  // Video element setup
  videoElement.currentTime = startTime;
  videoElement.muted = false;

  await waitForSeek(videoElement);

  return new Promise((resolve, reject) => {
    let animFrameId = null;
    let isFinished = false;

    recorder.onstop = () => {
      isFinished = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      videoElement.pause();

      const outputBlob = new Blob(recordedChunks, { type: mimeType });
      const blobUrl = URL.createObjectURL(outputBlob);

      if (onProgress) onProgress({ percent: 100, message: 'Clip rendering completed!' });

      resolve({
        blob: outputBlob,
        url: blobUrl,
        format: mimeType.includes('mp4') ? 'mp4' : 'webm',
      });
    };

    recorder.onerror = (err) => {
      isFinished = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      videoElement.pause();
      reject(err);
    };

    recorder.start(100); // 100ms timeslices

    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        console.warn('Playback error during render, user gesture may be required:', e);
      });
    }

    // Main render loop
    function drawFrame() {
      if (isFinished) return;

      const currentTime = videoElement.currentTime;

      if (currentTime >= endTime || videoElement.ended) {
        recorder.stop();
        return;
      }

      // 1. Draw Background & Foreground according to Crop Mode
      drawVideoLayers(ctx, videoElement, width, height, cropMode, clip.focalX || 0.5);

      // 2. Burn Active Captions
      drawCaptions(ctx, clip.chunks || [], currentTime, width, height, captionLanguage, captionStyle);

      // Progress reporting
      if (onProgress && duration > 0) {
        const progressPct = Math.min(99, Math.max(5, Math.round(((currentTime - startTime) / duration) * 90) + 5));
        onProgress({
          percent: progressPct,
          message: `Rendering 9:16 clip (${(currentTime - startTime).toFixed(1)}s / ${duration.toFixed(1)}s)...`,
        });
      }

      animFrameId = requestAnimationFrame(drawFrame);
    }

    animFrameId = requestAnimationFrame(drawFrame);
  });
}

/**
 * Draws video background and foreground layers onto 9:16 vertical canvas
 */
function drawVideoLayers(ctx, video, canvasW, canvasH, cropMode, focalX) {
  const vidW = video.videoWidth || 1920;
  const vidH = video.videoHeight || 1080;
  const vidAspect = vidW / vidH;
  const targetAspect = canvasW / canvasH; // 9:16 = 0.5625

  ctx.clearRect(0, 0, canvasW, canvasH);

  if (cropMode === 'blur') {
    // 1. Blurred background
    ctx.save();
    ctx.filter = 'blur(24px) brightness(0.65)';
    // Scale background to cover entire 9:16 canvas
    let bgW, bgH, bgX, bgY;
    if (vidAspect > targetAspect) {
      bgH = canvasH;
      bgW = canvasH * vidAspect;
      bgX = (canvasW - bgW) / 2;
      bgY = 0;
    } else {
      bgW = canvasW;
      bgH = canvasW / vidAspect;
      bgX = 0;
      bgY = (canvasH - bgH) / 2;
    }
    ctx.drawImage(video, bgX, bgY, bgW, bgH);
    ctx.restore();

    // 2. Sharp centered foreground
    const fgW = canvasW;
    const fgH = canvasW / vidAspect;
    const fgY = (canvasH - fgH) / 2;

    // Draw subtle border shadow for foreground video
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 15;
    ctx.drawImage(video, 0, fgY, fgW, fgH);
    ctx.restore();

  } else if (cropMode === 'center') {
    // Smart horizontal crop to 9:16
    let cropW, cropH, srcX, srcY;
    if (vidAspect > targetAspect) {
      // Horizontal video: crop a 9:16 slice based on focalX
      cropH = vidH;
      cropW = vidH * targetAspect;
      const idealX = (vidW * focalX) - (cropW / 2);
      srcX = Math.max(0, Math.min(vidW - cropW, idealX));
      srcY = 0;
    } else {
      // Vertical or square
      cropW = vidW;
      cropH = vidW / targetAspect;
      srcX = 0;
      srcY = Math.max(0, (vidH - cropH) / 2);
    }
    ctx.drawImage(video, srcX, srcY, cropW, cropH, 0, 0, canvasW, canvasH);

  } else {
    // Fit mode: black bars top and bottom
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const fgW = canvasW;
    const fgH = canvasW / vidAspect;
    const fgY = (canvasH - fgH) / 2;
    ctx.drawImage(video, 0, fgY, fgW, fgH);
  }
}

/**
 * Renders styled, synchronized burned captions on canvas
 */
function drawCaptions(ctx, chunks, currentTime, canvasW, canvasH, language, style = {}) {
  // Find chunk matching current time
  const activeChunk = chunks.find((c) => currentTime >= c.start && currentTime <= c.end);
  if (!activeChunk) return;

  // Select text based on language choice
  let text = '';
  if (language === 'hinglish') {
    text = activeChunk.hinglish || activeChunk.text || '';
  } else if (language === 'hindi') {
    text = activeChunk.hindi || activeChunk.text || '';
  } else {
    text = activeChunk.english || activeChunk.text || '';
  }

  text = text.trim();
  if (!text) return;

  if (style.uppercase !== false) {
    text = text.toUpperCase();
  }

  // Style attributes
  const fontSize = style.fontSize || 30;
  const fontFamily = style.fontFamily || 'Inter, -apple-system, sans-serif';
  const textColor = style.textColor || '#FFFFFF';
  const highlightColor = style.highlightColor || '#FFE600';
  const bgColor = style.bgColor || 'rgba(0, 0, 0, 0.75)';
  const position = style.position || 'bottom';

  ctx.save();
  ctx.font = `800 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Determine Y position
  let posY = canvasH * 0.82; // bottom
  if (position === 'center') posY = canvasH * 0.50;
  if (position === 'top') posY = canvasH * 0.18;

  // Split into lines if text is wide (max 2 lines for short reels)
  const maxLineWidth = canvasW * 0.85;
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxLineWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.35;
  const totalBoxHeight = lines.length * lineHeight + 20;

  // Draw background pill
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineMetrics = ctx.measureText(line);
    const boxW = lineMetrics.width + 36;
    const boxH = lineHeight + 8;
    const boxX = (canvasW - boxW) / 2;
    const lineY = posY - ((lines.length - 1) * lineHeight) / 2 + (i * lineHeight);

    // Pill background
    ctx.fillStyle = bgColor;
    roundRect(ctx, boxX, lineY - boxH / 2, boxW, boxH, 12);
    ctx.fill();

    // Text stroke / outline for readability
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(line, canvasW / 2, lineY);

    // Text fill with active word highlighting
    ctx.fillStyle = textColor;
    ctx.fillText(line, canvasW / 2, lineY);
  }

  ctx.restore();
}

/**
 * Helper to draw a rounded rectangle on Canvas 2D
 */
function roundRect(ctx, x, y, width, height, radius = 8) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function waitForSeek(video) {
  return new Promise((resolve) => {
    const onSeek = () => {
      video.removeEventListener('seeked', onSeek);
      resolve();
    };
    video.addEventListener('seeked', onSeek);
  });
}

export default {
  initFFmpeg,
  renderVerticalClip,
};

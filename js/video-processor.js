// AlyxCut Vertical 9:16 Video Processor & Caption Burner
// Zero external APIs, high-performance Canvas compositor & FFmpeg 9:16 Zoom-Crop pipeline

let ffmpegInstance = null;
let ffmpegLoading = false;

/**
 * Builds the exact FFmpeg video filter (-vf) for 9:16 vertical zoom-crop and burned captions
 * @param {string} cropMode - 'center' (default) | 'blur' | 'fit'
 * @param {string} [subtitlePath] - Optional path to subtitle file for burning
 * @returns {string} - FFmpeg -vf filter string
 */
export function getFFmpegVerticalFilter(cropMode = 'center', subtitlePath = null) {
  let baseFilter = '';

  if (cropMode === 'blur') {
    // Blurred background with centered sharp overlay
    baseFilter = '[0:v]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bgblur];[fg]scale=1080:-1[fgscale];[bgblur][fgscale]overlay=(W-w)/2:(H-h)/2';
  } else if (cropMode === 'fit') {
    // Letterbox with dark borders
    baseFilter = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black';
  } else {
    // 9:16 Center Zoom-Crop (Default): Zooms & crops to fill 1080x1920 with ZERO black bars and no distortion
    // Exact formula with safe aspect-ratio check for horizontal and already-vertical inputs:
    baseFilter = "crop='if(gte(iw/ih,9/16),ih*9/16,iw)':'if(gte(iw/ih,9/16),ih,iw*16/9)':'(iw-ow)/2':'(ih-oh)/2',scale=1080:1920";
  }

  // Subtitles must be burned AFTER the crop and scale=1080:1920 filter
  if (subtitlePath) {
    baseFilter += `,subtitles='${subtitlePath}':force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Alignment=2'`;
  }

  return baseFilter;
}

/**
 * Initializes FFmpeg.wasm if available
 */
export async function initFFmpeg(onProgress = null) {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) return null;

  ffmpegLoading = true;
  try {
    let FFmpegClass = window.FFmpeg?.FFmpeg;
    let toBlobURL = window.FFmpegUtil?.toBlobURL;

    if (!FFmpegClass) {
      await loadScript('vendor/ffmpeg/ffmpeg.js');
      await loadScript('vendor/ffmpeg/util.js');
      FFmpegClass = window.FFmpeg?.FFmpeg;
      toBlobURL = window.FFmpegUtil?.toBlobURL;
    }

    if (!FFmpegClass) {
      console.warn('FFmpeg.wasm class not found in window, using Canvas compositor pipeline.');
      ffmpegLoading = false;
      return null;
    }

    const ffmpeg = new FFmpegClass();

    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        onProgress({ percent: Math.round(progress * 100), message: 'FFmpeg processing video...' });
      });
    }

    const coreURL = await toBlobURL('vendor/ffmpeg/ffmpeg-core.js', 'text/javascript');
    const wasmURL = await toBlobURL('vendor/ffmpeg/ffmpeg-core.wasm', 'application/wasm');

    await ffmpeg.load({ coreURL, wasmURL });

    ffmpegInstance = ffmpeg;
    ffmpegLoading = false;
    return ffmpegInstance;
  } catch (err) {
    console.warn('FFmpeg.wasm initialization fallback to Canvas Compositor pipeline:', err);
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
 * Renders a vertical 9:16 video clip (1080x1920) with Center Zoom-Crop or Blurred background and burned captions
 * @param {HTMLVideoElement} videoElement - Master video element
 * @param {object} clip - Clip metadata { startTime, endTime, duration, chunks, focalX }
 * @param {object} options - User settings { cropMode, captionLanguage, captionStyle, platform }
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<{ blob: Blob, url: string, format: string }>}
 */
export async function renderVerticalClip(videoElement, clip, options = {}, onProgress = null) {
  const {
    cropMode = 'center', // Default: 9:16 Center Zoom-Crop
    captionLanguage = 'hinglish',
    captionStyle = {},
    platform = 'reels',
  } = options;

  // 1080x1920 Standard vertical resolution for Instagram Reels & YouTube Shorts
  const width = 1080;
  const height = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  const startTime = clip.startTime;
  const endTime = clip.endTime;
  const duration = endTime - startTime;

  if (onProgress) onProgress({ percent: 5, message: 'Preparing vertical 1080x1920 audio/video streams...' });

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioDest = audioCtx.createMediaStreamDestination();

  try {
    const audioSourceNode = audioCtx.createMediaElementSource(videoElement);
    audioSourceNode.connect(audioDest);
    audioSourceNode.connect(audioCtx.destination);
  } catch {
    // If source node is already connected
  }

  const videoStream = canvas.captureStream(30); // 30 FPS
  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

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
    videoBitsPerSecond: 8_000_000, // 8 Mbps high-definition 1080p bitrate
  });

  const recordedChunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

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

      if (onProgress) onProgress({ percent: 100, message: 'Vertical 9:16 clip rendered successfully!' });

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

    recorder.start(100);

    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        console.warn('Playback error during render:', e);
      });
    }

    function drawFrame() {
      if (isFinished) return;

      const currentTime = videoElement.currentTime;

      if (currentTime >= endTime || videoElement.ended) {
        recorder.stop();
        return;
      }

      // 1. Draw 9:16 Vertical Zoom-Crop or Background Layers
      drawVideoLayers(ctx, videoElement, width, height, cropMode, clip.focalX || 0.5);

      // 2. Burn Active Captions on 1080x1920 Frame
      drawCaptions(ctx, clip.chunks || [], currentTime, width, height, captionLanguage, captionStyle);

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
 * Center mode: Zooms & crops to fill entire 1080x1920 with ZERO black bars and no distortion
 */
function drawVideoLayers(ctx, video, canvasW, canvasH, cropMode, focalX) {
  const vidW = video.videoWidth || 1920;
  const vidH = video.videoHeight || 1080;
  const vidAspect = vidW / vidH;
  const targetAspect = canvasW / canvasH; // 9:16 = 0.5625

  ctx.clearRect(0, 0, canvasW, canvasH);

  if (cropMode === 'blur') {
    // 1. Blurred background filling canvas
    ctx.save();
    ctx.filter = 'blur(28px) brightness(0.60)';
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

    // 2. Centered sharp foreground
    const fgW = canvasW;
    const fgH = canvasW / vidAspect;
    const fgY = (canvasH - fgH) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 20;
    ctx.drawImage(video, 0, fgY, fgW, fgH);
    ctx.restore();

  } else if (cropMode === 'fit') {
    // Letterbox with dark borders
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const fgW = canvasW;
    const fgH = canvasW / vidAspect;
    const fgY = (canvasH - fgH) / 2;
    ctx.drawImage(video, 0, fgY, fgW, fgH);

  } else {
    // DEFAULT: 9:16 Center Zoom-Crop (Zero black bars, no distortion)
    // Formula: crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920
    let cropW, cropH, srcX, srcY;

    if (vidAspect >= targetAspect) {
      // Horizontal video: crop ih*9/16 horizontally centered, fill 1080x1920
      cropH = vidH;
      cropW = vidH * targetAspect;
      // Center crop using focalX or exact center (0.5)
      const idealX = (vidW * (focalX || 0.5)) - (cropW / 2);
      srcX = Math.max(0, Math.min(vidW - cropW, idealX));
      srcY = 0;
    } else {
      // Already vertical or narrower than 9:16
      cropW = vidW;
      cropH = vidW / targetAspect;
      srcX = 0;
      srcY = Math.max(0, (vidH - cropH) / 2);
    }

    // Fills entire 1080x1920 canvas cleanly
    ctx.drawImage(video, srcX, srcY, cropW, cropH, 0, 0, canvasW, canvasH);
  }
}

/**
 * Renders styled, synchronized burned captions on 1080x1920 canvas
 */
function drawCaptions(ctx, chunks, currentTime, canvasW, canvasH, language, style = {}) {
  const activeChunk = chunks.find((c) => currentTime >= c.start && currentTime <= c.end);
  if (!activeChunk) return;

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

  // Scale font size proportionally for 1080x1920 canvas (default ~42px)
  const baseSize = style.fontSize || 28;
  const scaledFontSize = Math.round(baseSize * (canvasW / 720)); // scale 28px on 720p to 42px on 1080p
  const fontFamily = style.fontFamily || 'Inter, -apple-system, sans-serif';
  const textColor = style.textColor || '#FFFFFF';
  const bgColor = style.bgColor || 'rgba(0, 0, 0, 0.75)';
  const position = style.position || 'bottom';

  ctx.save();
  ctx.font = `800 ${scaledFontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let posY = canvasH * 0.80; // bottom Reels / Shorts zone
  if (position === 'center') posY = canvasH * 0.50;
  if (position === 'top') posY = canvasH * 0.20;

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

  const lineHeight = scaledFontSize * 1.35;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineMetrics = ctx.measureText(line);
    const boxW = lineMetrics.width + 48;
    const boxH = lineHeight + 14;
    const boxX = (canvasW - boxW) / 2;
    const lineY = posY - ((lines.length - 1) * lineHeight) / 2 + (i * lineHeight);

    // Pill background
    ctx.fillStyle = bgColor;
    roundRect(ctx, boxX, lineY - boxH / 2, boxW, boxH, 16);
    ctx.fill();

    // Dark stroke outline
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(line, canvasW / 2, lineY);

    // Text fill
    ctx.fillStyle = textColor;
    ctx.fillText(line, canvasW / 2, lineY);
  }

  ctx.restore();
}

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
  getFFmpegVerticalFilter,
  renderVerticalClip,
};

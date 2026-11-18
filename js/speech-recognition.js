// AlyxCut Local Speech Recognition using Transformers.js (Whisper)
// 100% Client-Side, Zero External APIs, Zero Cost, Multilingual with Hinglish Transliteration

import { hindiToHinglish } from './transliterate.js';

let transcriberInstance = null;
let currentModelName = 'onnx-community/whisper-tiny';
let isModelLoading = false;

/**
 * Checks if WebGPU is available in this browser
 */
export async function checkWebGPUSupport() {
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return Boolean(adapter);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Dynamically loads the Transformers.js library
 */
async function loadTransformers() {
  if (window.transformers) {
    return window.transformers;
  }

  // Try local vendor first, fallback to CDN
  try {
    const module = await import('../vendor/transformers.web.min.js');
    window.transformers = module;
    return module;
  } catch (err) {
    console.warn('Loading Transformers.js from vendor failed, trying CDN fallback...', err);
    try {
      const module = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3');
      window.transformers = module;
      return module;
    } catch (cdnErr) {
      throw new Error(`Failed to load Transformers.js AI engine: ${cdnErr.message}`);
    }
  }
}

/**
 * Loads and caches the Whisper speech-to-text pipeline
 * @param {string} [modelName]
 * @param {Function} [onProgress]
 */
export async function getTranscriber(modelName = 'onnx-community/whisper-tiny', onProgress = null) {
  if (transcriberInstance && currentModelName === modelName) {
    return transcriberInstance;
  }

  if (isModelLoading) {
    throw new Error('AI Model is already in the process of loading.');
  }

  isModelLoading = true;

  try {
    const { pipeline, env } = await loadTransformers();

    // Optimize settings for browser execution
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    const hasWebGPU = await checkWebGPUSupport();
    const device = hasWebGPU ? 'webgpu' : 'wasm';

    if (onProgress) {
      onProgress({
        status: 'init',
        percent: 0,
        message: `Initializing Whisper AI (${device.toUpperCase()})...`,
        device,
      });
    }

    const transcriber = await pipeline('automatic-speech-recognition', modelName, {
      device,
      dtype: device === 'webgpu' ? 'fp32' : 'q8',
      progress_callback: (p) => {
        if (onProgress) {
          let percent = 0;
          let loadedMB = '';
          let totalMB = '';

          if (p.progress !== undefined) {
            percent = Math.min(100, Math.round(p.progress));
          } else if (p.loaded && p.total) {
            percent = Math.round((p.loaded / p.total) * 100);
            loadedMB = (p.loaded / (1024 * 1024)).toFixed(1);
            totalMB = (p.total / (1024 * 1024)).toFixed(1);
          }

          const fileInfo = p.file ? ` (${p.file.split('/').pop()})` : '';
          const sizeInfo = loadedMB && totalMB ? ` [${loadedMB}MB / ${totalMB}MB]` : '';

          onProgress({
            status: p.status,
            percent,
            file: p.file,
            message: `Downloading AI model${fileInfo}... ${percent}%${sizeInfo}`,
          });
        }
      },
    });

    transcriberInstance = transcriber;
    currentModelName = modelName;
    isModelLoading = false;

    if (onProgress) {
      onProgress({
        status: 'ready',
        percent: 100,
        message: 'Whisper AI model loaded successfully and cached locally.',
      });
    }

    return transcriber;
  } catch (error) {
    isModelLoading = false;
    console.error('Whisper pipeline initialization failed:', error);
    throw new Error(`AI Model loading error: ${error.message}`);
  }
}

/**
 * Transcribes audio float32 array using local Whisper model
 * Generates sentence-level timestamps and Hinglish/Hindi/English versions
 * @param {Float32Array} audioFloat32 - 16kHz mono audio samples
 * @param {object} options
 * @param {string} [options.language] - 'hindi', 'english', or auto
 * @param {Function} [options.onProgress]
 * @returns {Promise<{ fullText: string, hinglishText: string, chunks: Array }>}
 */
export async function transcribeAudio(audioFloat32, options = {}) {
  const { language = null, onProgress = null, modelName = 'onnx-community/whisper-tiny' } = options;

  if (onProgress) {
    onProgress({ stage: 'transcribing_start', percent: 10, message: 'Running speech recognition...' });
  }

  const transcriber = await getTranscriber(modelName, (p) => {
    if (onProgress && p.status !== 'ready') {
      onProgress({ stage: 'model_download', percent: p.percent, message: p.message });
    }
  });

  const transcribeConfig = {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  };

  if (language && language !== 'auto') {
    transcribeConfig.language = language;
  }

  if (onProgress) {
    onProgress({ stage: 'transcribing_chunks', percent: 45, message: 'Processing audio chunks and timestamps...' });
  }

  const output = await transcriber(audioFloat32, transcribeConfig);

  if (onProgress) {
    onProgress({ stage: 'transcribing_post', percent: 85, message: 'Generating Hinglish transliteration and sync data...' });
  }

  const rawChunks = Array.isArray(output.chunks) ? output.chunks : [];
  const processedChunks = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];
    const text = (chunk.text || '').trim();
    if (!text) continue;

    const start = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : 0;
    const end = Array.isArray(chunk.timestamp) ? (chunk.timestamp[1] || start + 2) : start + 2;

    // Generate Hinglish transliteration for Hindi text
    const hinglish = hindiToHinglish(text);

    processedChunks.push({
      id: i,
      original: text,
      hindi: text,
      hinglish: hinglish || text,
      english: text, // Whisper English if English mode, else original
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      duration: Number((end - start).toFixed(2)),
    });
  }

  const fullText = (output.text || '').trim();
  const fullHinglish = hindiToHinglish(fullText);

  if (onProgress) {
    onProgress({ stage: 'transcribe_done', percent: 100, message: 'Speech recognition complete!' });
  }

  return {
    fullText,
    hinglishText: fullHinglish,
    chunks: processedChunks,
  };
}

/**
 * Clears in-memory model instance
 */
export function resetTranscriber() {
  transcriberInstance = null;
  isModelLoading = false;
}

export default {
  getTranscriber,
  transcribeAudio,
  checkWebGPUSupport,
  resetTranscriber,
};

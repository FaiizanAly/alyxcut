// AlyxCut Speech Recognition Client
// Offloads heavy Transformers.js Whisper inference to a dedicated Web Worker (workers/ai-worker.js)
// Prevents "Page Unresponsive" freezes, supports WebGPU & multi-threaded WASM fallback

let aiWorkerInstance = null;
let pendingTranscribe = null;

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
 * Returns or creates the dedicated AI Web Worker
 */
function getAIWorker() {
  if (aiWorkerInstance) return aiWorkerInstance;

  try {
    aiWorkerInstance = new Worker(new URL('../workers/ai-worker.js', import.meta.url), {
      type: 'module',
    });

    aiWorkerInstance.onerror = (err) => {
      console.error('AI Worker error:', err);
    };

    return aiWorkerInstance;
  } catch (err) {
    console.warn('Could not spawn dedicated AI Worker, falling back to window thread:', err);
    return null;
  }
}

/**
 * Pre-initializes the Whisper speech-to-text model inside the Web Worker
 * @param {string} [modelName]
 * @param {Function} [onProgress]
 */
export async function getTranscriber(modelName = 'onnx-community/whisper-tiny', onProgress = null) {
  const worker = getAIWorker();
  if (!worker) {
    // Inline fallback if workers are not permitted
    return inlineGetTranscriber(modelName, onProgress);
  }

  return new Promise((resolve, reject) => {
    const id = `init_${Date.now()}`;

    const handler = (e) => {
      const data = e.data;
      if (data.type === 'PROGRESS' && onProgress) {
        onProgress({
          status: data.stage,
          percent: data.percent,
          message: data.message,
        });
      } else if (data.id === id && data.type === 'INIT_SUCCESS') {
        worker.removeEventListener('message', handler);
        resolve(true);
      } else if (data.id === id && data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(data.error));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ id, type: 'INIT', options: { modelName } });
  });
}

/**
 * Transcribes audio float32 array using background AI Web Worker
 * Keeps main thread UI 100% responsive
 * @param {Float32Array} audioFloat32 - 16kHz mono audio samples
 * @param {object} options
 * @param {string} [options.language] - 'hindi', 'english', or auto
 * @param {Function} [options.onProgress]
 * @returns {Promise<{ fullText: string, hinglishText: string, chunks: Array }>}
 */
export async function transcribeAudio(audioFloat32, options = {}) {
  const { language = null, onProgress = null, modelName = 'onnx-community/whisper-tiny' } = options;

  const worker = getAIWorker();
  if (!worker) {
    return inlineTranscribeAudio(audioFloat32, options);
  }

  return new Promise((resolve, reject) => {
    const id = `transcribe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const handler = (e) => {
      const data = e.data;
      if (data.type === 'PROGRESS' && onProgress) {
        onProgress({
          stage: data.stage,
          percent: data.percent,
          message: data.message,
        });
      } else if (data.id === id && data.type === 'TRANSCRIBE_SUCCESS') {
        worker.removeEventListener('message', handler);
        resolve(data.result);
      } else if (data.id === id && data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(data.error));
      }
    };

    worker.addEventListener('message', handler);

    // Transfer Float32Array buffer to worker without cloning to save memory
    worker.postMessage(
      {
        id,
        type: 'TRANSCRIBE',
        audioData: audioFloat32,
        options: { language, modelName },
      },
      [audioFloat32.buffer]
    );
  });
}

// ----------------- INLINE FALLBACK (Only if Web Worker is blocked) -----------------

let inlineTranscriberInstance = null;

async function inlineGetTranscriber(modelName, onProgress) {
  if (inlineTranscriberInstance) return inlineTranscriberInstance;
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  const hasWebGPU = await checkWebGPUSupport();
  const device = hasWebGPU ? 'webgpu' : 'wasm';

  inlineTranscriberInstance = await pipeline('automatic-speech-recognition', modelName, {
    device,
    dtype: 'q8',
    progress_callback: (p) => {
      if (onProgress) {
        const pct = p.progress ? Math.round(p.progress) : p.loaded ? Math.round((p.loaded / p.total) * 100) : 0;
        onProgress({ status: p.status, percent: pct, message: `Downloading model... ${pct}%` });
      }
    },
  });
  return inlineTranscriberInstance;
}

async function inlineTranscribeAudio(audioFloat32, options) {
  const { language = null, onProgress = null, modelName = 'onnx-community/whisper-tiny' } = options;
  const pipe = await inlineGetTranscriber(modelName, onProgress);
  const { hindiToHinglish } = await import('./transliterate.js');

  const output = await pipe(audioFloat32, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
    language: language !== 'auto' ? language : null,
  });

  const rawChunks = Array.isArray(output.chunks) ? output.chunks : [];
  const processedChunks = rawChunks.map((chunk, i) => {
    const text = (chunk.text || '').trim();
    const start = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : 0;
    const end = Array.isArray(chunk.timestamp) ? (chunk.timestamp[1] || start + 2) : start + 2;
    return {
      id: i,
      original: text,
      hindi: text,
      hinglish: hindiToHinglish(text) || text,
      english: text,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      duration: Number((end - start).toFixed(2)),
    };
  });

  const fullText = (output.text || '').trim();
  return {
    fullText,
    hinglishText: hindiToHinglish(fullText),
    chunks: processedChunks,
  };
}

/**
 * Resets worker instance
 */
export function resetTranscriber() {
  if (aiWorkerInstance) {
    aiWorkerInstance.terminate();
    aiWorkerInstance = null;
  }
  inlineTranscriberInstance = null;
}

export default {
  getTranscriber,
  transcribeAudio,
  checkWebGPUSupport,
  resetTranscriber,
};

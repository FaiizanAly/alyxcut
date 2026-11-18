// AlyxCut Dedicated AI Speech Recognition Worker
// Executes Transformers.js Whisper in a background thread to prevent UI freezing

import { hindiToHinglish } from '../js/transliterate.js';

let transcriber = null;
let currentModelName = null;

async function loadTransformers() {
  if (self.transformers) return self.transformers;
  try {
    const module = await import('@huggingface/transformers');
    self.transformers = module;
    return module;
  } catch {
    try {
      const module = await import('../vendor/transformers.web.min.js');
      self.transformers = module;
      return module;
    } catch {
      const module = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3');
      self.transformers = module;
      return module;
    }
  }
}

async function getTranscriber(modelName = 'onnx-community/whisper-tiny') {
  if (transcriber && currentModelName === modelName) {
    return transcriber;
  }

  const { pipeline, env } = await loadTransformers();
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  const hasWebGPU = typeof navigator !== 'undefined' && Boolean(navigator.gpu);
  const device = hasWebGPU ? 'webgpu' : 'wasm';

  self.postMessage({
    type: 'PROGRESS',
    stage: 'model_init',
    percent: 0,
    message: `Initializing quantized Whisper AI model (${device.toUpperCase()})...`,
  });

  transcriber = await pipeline('automatic-speech-recognition', modelName, {
    device,
    dtype: 'q8', // Lightweight quantized model by default to prevent memory & CPU lock
    progress_callback: (p) => {
      let percent = 0;
      if (p.progress !== undefined) {
        percent = Math.min(100, Math.round(p.progress));
      } else if (p.loaded && p.total) {
        percent = Math.round((p.loaded / p.total) * 100);
      }
      self.postMessage({
        type: 'PROGRESS',
        stage: 'model_download',
        percent,
        file: p.file,
        message: `Downloading Whisper AI model${p.file ? ` (${p.file.split('/').pop()})` : ''}... ${percent}%`,
      });
    },
  });

  currentModelName = modelName;
  return transcriber;
}

self.onmessage = async (e) => {
  const { id, type, audioData, options = {} } = e.data;

  if (type === 'INIT') {
    try {
      await getTranscriber(options.modelName || 'onnx-community/whisper-tiny');
      self.postMessage({ id, type: 'INIT_SUCCESS' });
    } catch (err) {
      self.postMessage({ id, type: 'ERROR', error: err.message });
    }
    return;
  }

  if (type === 'TRANSCRIBE') {
    try {
      const modelName = options.modelName || 'onnx-community/whisper-tiny';
      const pipe = await getTranscriber(modelName);

      self.postMessage({
        type: 'PROGRESS',
        stage: 'transcribe_running',
        percent: 30,
        message: 'Speech recognition in progress inside background worker...',
      });

      const transcribeConfig = {
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      };

      if (options.language && options.language !== 'auto') {
        transcribeConfig.language = options.language;
      }

      const output = await pipe(audioData, transcribeConfig);

      self.postMessage({
        type: 'PROGRESS',
        stage: 'transcribe_post',
        percent: 90,
        message: 'Generating synchronized Hinglish captions...',
      });

      const rawChunks = Array.isArray(output.chunks) ? output.chunks : [];
      const processedChunks = [];

      for (let i = 0; i < rawChunks.length; i++) {
        const chunk = rawChunks[i];
        const text = (chunk.text || '').trim();
        if (!text) continue;

        const start = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : 0;
        const end = Array.isArray(chunk.timestamp) ? (chunk.timestamp[1] || start + 2) : start + 2;
        const hinglish = hindiToHinglish(text);

        processedChunks.push({
          id: i,
          original: text,
          hindi: text,
          hinglish: hinglish || text,
          english: text,
          start: Number(start.toFixed(2)),
          end: Number(end.toFixed(2)),
          duration: Number((end - start).toFixed(2)),
        });
      }

      const fullText = (output.text || '').trim();
      const fullHinglish = hindiToHinglish(fullText);

      self.postMessage({
        id,
        type: 'TRANSCRIBE_SUCCESS',
        result: {
          fullText,
          hinglishText: fullHinglish,
          chunks: processedChunks,
        },
      });
    } catch (err) {
      console.error('AI Worker error:', err);
      self.postMessage({ id, type: 'ERROR', error: err.message });
    }
  }
};

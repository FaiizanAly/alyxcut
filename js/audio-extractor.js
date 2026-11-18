// AlyxCut Audio Extractor
// Extracts 16,000 Hz Mono Float32Array PCM audio required by Whisper models
// Uses high-speed native Web Audio API with dedicated Worker / WORKERFS fallback for large files
// Non-blocking, yields to main thread to guarantee UI responsiveness

let videoWorkerInstance = null;

function getVideoWorker() {
  if (videoWorkerInstance) return videoWorkerInstance;
  try {
    videoWorkerInstance = new Worker(new URL('../workers/video-worker.js', import.meta.url), {
      type: 'module',
    });
    return videoWorkerInstance;
  } catch (err) {
    console.warn('Could not spawn video worker, falling back to direct Web Audio:', err);
    return null;
  }
}

/**
 * Resamples an AudioBuffer to 16kHz mono Float32Array
 * @param {AudioBuffer} audioBuffer
 * @returns {Promise<Float32Array>}
 */
async function resampleTo16kHz(audioBuffer) {
  const targetSampleRate = 16000;
  const numberOfChannels = 1;
  const duration = audioBuffer.duration;
  const targetLength = Math.round(duration * targetSampleRate);

  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
    numberOfChannels,
    targetLength,
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer.getChannelData(0);
}

/**
 * Decodes an ArrayBuffer using Web Audio API and resamples to 16kHz mono
 */
async function decodeBufferWithWebAudio(arrayBuffer, onProgress = null) {
  if (onProgress) onProgress({ stage: 'decoding', percent: 40, message: 'Decoding audio stream...' });

  // Yield to UI thread
  await new Promise((resolve) => setTimeout(resolve, 16));

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let decodedBuffer;

  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    audioCtx.close();
    throw new Error(
      `Could not decode audio directly via Web Audio: ${err.message}. Format may require FFmpeg extraction.`
    );
  }

  if (onProgress) onProgress({ stage: 'resampling', percent: 80, message: 'Resampling to 16kHz mono PCM for Whisper...' });

  await new Promise((resolve) => setTimeout(resolve, 16));

  const pcm16k = await resampleTo16kHz(decodedBuffer);
  audioCtx.close();

  if (onProgress) onProgress({ stage: 'complete', percent: 100, message: 'Audio extraction complete.' });

  return {
    audioData: pcm16k,
    duration: decodedBuffer.duration,
    sampleRate: 16000,
  };
}

/**
 * Extracts audio via dedicated Worker using WORKERFS streaming for large files
 */
export async function extractAudioViaWorker(file, onProgress = null) {
  const worker = getVideoWorker();
  if (!worker) throw new Error('Video Worker not available.');

  return new Promise((resolve, reject) => {
    const id = `extract_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const handler = async (e) => {
      const data = e.data;
      if (data.type === 'PROGRESS' && onProgress) {
        onProgress({ stage: 'worker_extract', percent: data.percent, message: data.message });
      } else if (data.id === id && data.type === 'EXTRACT_SUCCESS') {
        worker.removeEventListener('message', handler);
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const decoded = await audioCtx.decodeAudioData(data.wavBytes.buffer);
          const pcm = decoded.getChannelData(0);
          audioCtx.close();
          resolve({
            audioData: pcm,
            duration: decoded.duration,
            sampleRate: 16000,
          });
        } catch (err) {
          reject(err);
        }
      } else if (data.id === id && data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(data.error));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ id, type: 'EXTRACT_AUDIO_WORKERFS', file });
  });
}

/**
 * Extracts 16kHz mono audio from File, Blob, ArrayBuffer, or Uint8Array
 * Streams large files via WORKERFS to avoid cloning hundreds of MB in JS memory
 * @param {File|Blob|ArrayBuffer|Uint8Array} audioSource
 * @param {Function} [onProgress]
 * @returns {Promise<{ audioData: Float32Array, duration: number, sampleRate: number }>}
 */
export async function extractAudioFromVideo(audioSource, onProgress = null) {
  if (onProgress) onProgress({ stage: 'reading', percent: 10, message: 'Preparing audio extraction...' });

  // If already in memory (ArrayBuffer or Uint8Array)
  if (audioSource instanceof ArrayBuffer || audioSource instanceof Uint8Array) {
    const buffer = audioSource instanceof Uint8Array ? audioSource.buffer : audioSource;
    return decodeBufferWithWebAudio(buffer, onProgress);
  }

  // If a File/Blob: check size. For files >= 80MB, prefer Worker + WORKERFS streaming
  const isLargeFile = audioSource.size && audioSource.size >= 80 * 1024 * 1024;
  if (isLargeFile && typeof Worker !== 'undefined') {
    try {
      if (onProgress) onProgress({ stage: 'worker_extract', percent: 20, message: 'Streaming audio via background worker (WORKERFS)...' });
      return await extractAudioViaWorker(audioSource, onProgress);
    } catch (err) {
      console.warn('WORKERFS streaming extraction failed, falling back to direct decode:', err);
    }
  }

  // Direct decode for small files or fallback
  let arrayBuffer;
  if (typeof audioSource.arrayBuffer === 'function') {
    arrayBuffer = await audioSource.arrayBuffer();
  } else {
    throw new Error('Unsupported audio source format.');
  }

  return decodeBufferWithWebAudio(arrayBuffer, onProgress);
}

/**
 * Fallback audio extractor using FFmpeg if Web Audio cannot decode the container/codec
 * @param {object} ffmpegInstance - Initialized FFmpeg instance
 * @param {File|Blob|ArrayBuffer|Uint8Array} audioSource
 * @param {Function} [onProgress]
 * @returns {Promise<{ audioData: Float32Array, duration: number, sampleRate: number }>}
 */
export async function extractAudioWithFFmpeg(ffmpegInstance, audioSource, onProgress = null) {
  if (onProgress) onProgress({ stage: 'ffmpeg_extract', percent: 30, message: 'Extracting audio via FFmpeg...' });

  const inputName = 'input_' + Date.now() + '.tmp';
  const outputWav = 'audio_' + Date.now() + '.wav';

  let buffer;
  if (audioSource instanceof Uint8Array) {
    buffer = audioSource;
  } else if (audioSource instanceof ArrayBuffer) {
    buffer = new Uint8Array(audioSource);
  } else if (audioSource && typeof audioSource.arrayBuffer === 'function') {
    buffer = new Uint8Array(await audioSource.arrayBuffer());
  } else {
    throw new Error('Invalid audioSource provided to extractAudioWithFFmpeg.');
  }

  await ffmpegInstance.writeFile(inputName, buffer);

  await ffmpegInstance.exec([
    '-i', inputName,
    '-vn',
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    outputWav,
  ]);

  const wavData = await ffmpegInstance.readFile(outputWav);

  await ffmpegInstance.deleteFile(inputName);
  await ffmpegInstance.deleteFile(outputWav);

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(wavData.buffer);
  const pcmData = audioBuffer.getChannelData(0);
  audioCtx.close();

  return {
    audioData: pcmData,
    duration: audioBuffer.duration,
    sampleRate: 16000,
  };
}

export default {
  extractAudioFromVideo,
  extractAudioViaWorker,
  extractAudioWithFFmpeg,
};

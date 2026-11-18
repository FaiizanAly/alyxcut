// AlyxCut Audio Extractor
// Extracts 16,000 Hz Mono Float32Array PCM audio required by Whisper models
// Uses high-speed native Web Audio API with FFmpeg.wasm fallback
// Fully supports in-memory ArrayBuffer / Uint8Array to eliminate NotReadableError

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

  // Use OfflineAudioContext for clean, hardware-accelerated resampling
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
 * Extracts 16kHz mono audio from in-memory ArrayBuffer, Uint8Array, Blob, or File
 * @param {ArrayBuffer|Uint8Array|Blob|File} audioSource - Audio source in memory
 * @param {Function} [onProgress] - Optional progress callback
 * @returns {Promise<{ audioData: Float32Array, duration: number, sampleRate: number }>}
 */
export async function extractAudioFromVideo(audioSource, onProgress = null) {
  if (onProgress) onProgress({ stage: 'reading', percent: 10, message: 'Accessing in-memory audio stream...' });

  let arrayBuffer;
  if (audioSource instanceof ArrayBuffer) {
    arrayBuffer = audioSource;
  } else if (audioSource instanceof Uint8Array) {
    arrayBuffer = audioSource.buffer;
  } else if (audioSource && typeof audioSource.arrayBuffer === 'function') {
    arrayBuffer = await audioSource.arrayBuffer();
  } else {
    throw new Error('Invalid audioSource provided to extractAudioFromVideo.');
  }

  if (onProgress) onProgress({ stage: 'decoding', percent: 40, message: 'Decoding audio stream...' });

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
 * Fallback audio extractor using FFmpeg if Web Audio cannot decode the container/codec
 * @param {object} ffmpegInstance - Initialized FFmpeg instance
 * @param {ArrayBuffer|Uint8Array|Blob|File} audioSource - Video audio source
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

  // Extract 16kHz mono WAV PCM
  await ffmpegInstance.exec([
    '-i', inputName,
    '-vn',
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    outputWav
  ]);

  const wavData = await ffmpegInstance.readFile(outputWav);

  // Clean up virtual files
  await ffmpegInstance.deleteFile(inputName);
  await ffmpegInstance.deleteFile(outputWav);

  // Decode WAV bytes using AudioContext
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
  extractAudioWithFFmpeg,
};

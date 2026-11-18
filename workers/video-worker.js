// AlyxCut Dedicated Video Worker
// Offloads heavy FFmpeg operations and streams directly via WORKERFS to prevent RAM bloat

let ffmpeg = null;

async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg;

  let FFmpegClass = self.FFmpeg?.FFmpeg;
  let toBlobURL = self.FFmpegUtil?.toBlobURL;

  if (!FFmpegClass) {
    try {
      importScripts('../vendor/ffmpeg/ffmpeg.js', '../vendor/ffmpeg/util.js');
      FFmpegClass = self.FFmpeg?.FFmpeg;
      toBlobURL = self.FFmpegUtil?.toBlobURL;
    } catch {
      // Fallback
    }
  }

  if (!FFmpegClass) {
    throw new Error('FFmpeg is not available in worker context.');
  }

  ffmpeg = new FFmpegClass();
  const coreURL = await toBlobURL('../vendor/ffmpeg/ffmpeg-core.js', 'text/javascript');
  const wasmURL = await toBlobURL('../vendor/ffmpeg/ffmpeg-core.wasm', 'application/wasm');

  await ffmpeg.load({ coreURL, wasmURL });
  return ffmpeg;
}

self.onmessage = async (e) => {
  const { id, type, file, options = {} } = e.data;

  if (type === 'EXTRACT_AUDIO_WORKERFS') {
    try {
      const ff = await loadFFmpeg();

      self.postMessage({
        type: 'PROGRESS',
        percent: 25,
        message: 'Mounting video file via WORKERFS for zero-copy streaming...',
      });

      // Prepare WORKERFS directory
      try {
        await ff.createDir('/input');
      } catch {
        // already exists
      }

      let mounted = false;
      let inputPath = `/input/${file.name}`;

      try {
        await ff.mount('WORKERFS', { files: [file] }, '/input');
        mounted = true;
      } catch (mountErr) {
        console.warn('WORKERFS mount failed, fallback to reading file buffer:', mountErr);
        const buf = new Uint8Array(await file.arrayBuffer());
        inputPath = 'input.tmp';
        await ff.writeFile(inputPath, buf);
      }

      self.postMessage({
        type: 'PROGRESS',
        percent: 50,
        message: 'FFmpeg extracting 16kHz audio stream in background...',
      });

      const outputWav = 'audio_16k.wav';

      await ff.exec([
        '-i', inputPath,
        '-vn',
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        outputWav,
      ]);

      const wavBytes = await ff.readFile(outputWav);

      if (mounted) {
        try {
          await ff.unmount('/input');
        } catch {}
      } else {
        try {
          await ff.deleteFile(inputPath);
        } catch {}
      }
      try {
        await ff.deleteFile(outputWav);
      } catch {}

      self.postMessage({
        id,
        type: 'EXTRACT_SUCCESS',
        wavBytes,
      }, [wavBytes.buffer]); // Transfer buffer without cloning
    } catch (err) {
      console.error('Video worker audio extraction error:', err);
      self.postMessage({ id, type: 'ERROR', error: err.message });
    }
  }
};

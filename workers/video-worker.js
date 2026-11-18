// AlyxCut Dedicated Video Worker
// Offloads heavy FFmpeg operations and streams directly via WORKERFS
// Exact 9:16 vertical Zoom-Crop filter: crop='if(gte(iw/ih,9/16),ih*9/16,iw)':'if(gte(iw/ih,9/16),ih,iw*16/9)':'(iw-ow)/2':'(ih-oh)/2',scale=1080:1920

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
      }, [wavBytes.buffer]);
    } catch (err) {
      console.error('Video worker audio extraction error:', err);
      self.postMessage({ id, type: 'ERROR', error: err.message });
    }
  }

  if (type === 'RENDER_CLIP_FFMPEG') {
    try {
      const ff = await loadFFmpeg();
      const { startTime = 0, endTime = 60, cropMode = 'center' } = options;

      const inputName = `source_${Date.now()}.tmp`;
      const outputName = `clip_${Date.now()}.mp4`;

      const buf = new Uint8Array(await file.arrayBuffer());
      await ff.writeFile(inputName, buf);

      // Exact 9:16 vertical zoom-crop formula:
      // crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920 with safe aspect ratio handling
      let vf = "crop='if(gte(iw/ih,9/16),ih*9/16,iw)':'if(gte(iw/ih,9/16),ih,iw*16/9)':'(iw-ow)/2':'(ih-oh)/2',scale=1080:1920";

      if (cropMode === 'blur') {
        vf = '[0:v]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bgblur];[fg]scale=1080:-1[fgscale];[bgblur][fgscale]overlay=(W-w)/2:(H-h)/2';
      } else if (cropMode === 'fit') {
        vf = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black';
      }

      await ff.exec([
        '-ss', String(startTime),
        '-to', String(endTime),
        '-i', inputName,
        '-vf', vf,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        '-b:a', '128k',
        outputName,
      ]);

      const outBytes = await ff.readFile(outputName);

      await ff.deleteFile(inputName);
      await ff.deleteFile(outputName);

      self.postMessage({ id, type: 'RENDER_SUCCESS', outBytes }, [outBytes.buffer]);
    } catch (err) {
      console.error('Video worker render clip error:', err);
      self.postMessage({ id, type: 'ERROR', error: err.message });
    }
  }
};

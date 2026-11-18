// AlyxCut Settings and System Diagnostics Module
// Handles user preferences, model download triggers, cache clearing, and hardware audit

import { getSettings, saveSettings, clearAllProjects, getStorageEstimate } from './storage.js';
import { getTranscriber, checkWebGPUSupport, resetTranscriber } from './speech-recognition.js';

/**
 * Initializes settings inputs with stored values
 */
export async function loadSettingsIntoUI() {
  const settings = await getSettings();

  const langSelect = document.getElementById('setting-caption-lang');
  const durSelect = document.getElementById('setting-clip-dur');
  const countSelect = document.getElementById('setting-clip-count');
  const platformSelect = document.getElementById('setting-platform');
  const cropSelect = document.getElementById('setting-crop-mode');
  const fontSizeInput = document.getElementById('setting-font-size');
  const posSelect = document.getElementById('setting-caption-pos');
  const boldCheck = document.getElementById('setting-bold-captions');
  const highlightCheck = document.getElementById('setting-highlight-words');

  if (langSelect) langSelect.value = settings.captionLanguage || 'hinglish';
  if (durSelect) durSelect.value = String(settings.clipDuration || 'auto');
  if (countSelect) countSelect.value = String(settings.clipCount || 'auto');
  if (platformSelect) platformSelect.value = settings.platform || 'reels';
  if (cropSelect) cropSelect.value = settings.cropMode || 'blur';

  if (fontSizeInput) fontSizeInput.value = settings.captionStyle?.fontSize || 28;
  if (posSelect) posSelect.value = settings.captionStyle?.position || 'bottom';
  if (boldCheck) boldCheck.checked = settings.captionStyle?.bold !== false;
  if (highlightCheck) highlightCheck.checked = settings.captionStyle?.wordHighlight !== false;

  await updateHardwareDiagnosticsUI();
  await updateStorageDiagnosticsUI();
}

/**
 * Saves current UI settings into IndexedDB
 */
export async function saveSettingsFromUI() {
  const langSelect = document.getElementById('setting-caption-lang');
  const durSelect = document.getElementById('setting-clip-dur');
  const countSelect = document.getElementById('setting-clip-count');
  const platformSelect = document.getElementById('setting-platform');
  const cropSelect = document.getElementById('setting-crop-mode');
  const fontSizeInput = document.getElementById('setting-font-size');
  const posSelect = document.getElementById('setting-caption-pos');
  const boldCheck = document.getElementById('setting-bold-captions');
  const highlightCheck = document.getElementById('setting-highlight-words');

  const durVal = durSelect?.value === 'auto' ? 'auto' : parseInt(durSelect?.value, 10);
  const countVal = countSelect?.value === 'auto' ? 'auto' : parseInt(countSelect?.value, 10);

  const newSettings = {
    captionLanguage: langSelect?.value || 'hinglish',
    clipDuration: durVal,
    clipCount: countVal,
    platform: platformSelect?.value || 'reels',
    cropMode: cropSelect?.value || 'blur',
    captionStyle: {
      fontSize: parseInt(fontSizeInput?.value, 10) || 28,
      position: posSelect?.value || 'bottom',
      bold: boldCheck ? boldCheck.checked : true,
      wordHighlight: highlightCheck ? highlightCheck.checked : true,
      textColor: '#FFFFFF',
      highlightColor: '#FFE600',
      bgColor: 'rgba(0, 0, 0, 0.75)',
      uppercase: true,
    },
  };

  await saveSettings(newSettings);
  return newSettings;
}

/**
 * Audits client hardware capabilities
 */
export async function updateHardwareDiagnosticsUI() {
  const webgpuEl = document.getElementById('diag-webgpu');
  const sabEl = document.getElementById('diag-sab');
  const coresEl = document.getElementById('diag-cores');
  const memoryEl = document.getElementById('diag-memory');

  const hasWebGPU = await checkWebGPUSupport();
  const hasSAB = typeof SharedArrayBuffer !== 'undefined';
  const cores = navigator.hardwareConcurrency || 'N/A';
  const memory = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Standard';

  if (webgpuEl) {
    webgpuEl.textContent = hasWebGPU ? '✅ Supported (Accelerated)' : '⚠️ Not Available (Using WASM Fallback)';
    webgpuEl.className = hasWebGPU ? 'diag-status ok' : 'diag-status warn';
  }

  if (sabEl) {
    sabEl.textContent = hasSAB ? '✅ Active (COOP/COEP Enabled)' : '⚠️ Inactive';
    sabEl.className = hasSAB ? 'diag-status ok' : 'diag-status warn';
  }

  if (coresEl) coresEl.textContent = `${cores} Threads`;
  if (memoryEl) memoryEl.textContent = memory;
}

/**
 * Updates storage usage readout
 */
export async function updateStorageDiagnosticsUI() {
  const storageEl = document.getElementById('diag-storage-usage');
  if (!storageEl) return;

  const est = await getStorageEstimate();
  storageEl.textContent = `${est.usageMB} MB used (out of ~${est.quotaMB} MB available)`;
}

/**
 * Pre-downloads the Whisper model into browser cache
 */
export async function preDownloadWhisperModel(onProgress) {
  const modelStatusEl = document.getElementById('model-status-text');
  if (modelStatusEl) modelStatusEl.textContent = 'Downloading model...';

  try {
    await getTranscriber('onnx-community/whisper-tiny', (p) => {
      if (onProgress) onProgress(p);
      if (modelStatusEl) {
        modelStatusEl.textContent = p.message || `${p.percent}%`;
      }
    });

    if (modelStatusEl) modelStatusEl.textContent = '✅ Model Cached & Ready in IndexedDB';
    await updateStorageDiagnosticsUI();
    return true;
  } catch (err) {
    if (modelStatusEl) modelStatusEl.textContent = `❌ Download Failed: ${err.message}`;
    throw err;
  }
}

/**
 * Clears cached models from CacheStorage and IndexedDB
 */
export async function clearCachedModels() {
  resetTranscriber();

  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    for (const key of keys) {
      if (key.includes('transformers') || key.includes('onnx') || key.includes('huggingface')) {
        await caches.delete(key);
      }
    }
  }

  const modelStatusEl = document.getElementById('model-status-text');
  if (modelStatusEl) modelStatusEl.textContent = 'Model cache cleared. Will download upon next use.';

  await updateStorageDiagnosticsUI();
}

/**
 * Clears all saved projects from IndexedDB
 */
export async function clearAllLocalProjects() {
  await clearAllProjects();
  await updateStorageDiagnosticsUI();
}

export default {
  loadSettingsIntoUI,
  saveSettingsFromUI,
  updateHardwareDiagnosticsUI,
  updateStorageDiagnosticsUI,
  preDownloadWhisperModel,
  clearCachedModels,
  clearAllLocalProjects,
};

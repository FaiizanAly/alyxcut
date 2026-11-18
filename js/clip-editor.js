// AlyxCut Built-in Lightweight Clip Editor
// Edit start/end time, captions text, styling, and crop mode with live preview

import { formatDuration } from './upload.js';
import { renderVerticalClip } from './video-processor.js';

let currentEditingClip = null;
let currentProject = null;
let masterVideoElement = null;
let onSaveCallback = null;

/**
 * Opens the clip editor modal
 * @param {object} clip - Clip to edit
 * @param {object} project - Associated project
 * @param {HTMLVideoElement} masterVideo - Master video element
 * @param {Function} onSave - Callback when clip is re-rendered/saved
 */
export function openClipEditor(clip, project, masterVideo, onSave) {
  currentEditingClip = JSON.parse(JSON.stringify(clip));
  currentProject = project;
  masterVideoElement = masterVideo;
  onSaveCallback = onSave;

  const modal = document.getElementById('clip-editor-modal');
  if (!modal) return;

  // Populate fields
  const titleInput = document.getElementById('edit-clip-title');
  const startInput = document.getElementById('edit-clip-start');
  const endInput = document.getElementById('edit-clip-end');
  const durationSpan = document.getElementById('edit-clip-duration');
  const cropSelect = document.getElementById('edit-clip-crop');
  const langSelect = document.getElementById('edit-clip-lang');
  const captionTextarea = document.getElementById('edit-clip-captions');
  const previewVideo = document.getElementById('edit-preview-video');

  if (titleInput) titleInput.value = clip.title || '';
  if (startInput) startInput.value = clip.startTime || 0;
  if (endInput) endInput.value = clip.endTime || 0;
  if (durationSpan) durationSpan.textContent = formatDuration(clip.endTime - clip.startTime);
  if (cropSelect) cropSelect.value = clip.cropMode || 'blur';
  if (langSelect) langSelect.value = clip.captionLanguage || 'hinglish';

  // Populate caption text from chunks
  const captionsText = (clip.chunks || []).map((c) => {
    const lang = langSelect ? langSelect.value : 'hinglish';
    const txt = lang === 'hindi' ? c.hindi : lang === 'english' ? c.english : c.hinglish;
    return `[${formatDuration(c.start)} - ${formatDuration(c.end)}] ${txt}`;
  }).join('\n');

  if (captionTextarea) captionTextarea.value = captionsText;

  // Set preview video
  if (previewVideo) {
    if (clip.blobUrl) {
      previewVideo.src = clip.blobUrl;
    } else if (masterVideoElement && masterVideoElement.src) {
      previewVideo.src = masterVideoElement.src;
      previewVideo.currentTime = clip.startTime;
    }
  }

  modal.classList.add('active');
}

/**
 * Closes the clip editor modal
 */
export function closeClipEditor() {
  const modal = document.getElementById('clip-editor-modal');
  if (modal) modal.classList.remove('active');

  const previewVideo = document.getElementById('edit-preview-video');
  if (previewVideo) {
    previewVideo.pause();
    previewVideo.src = '';
  }

  currentEditingClip = null;
}

/**
 * Re-renders the current clip with updated settings
 */
export async function reRenderCurrentClip(onProgress) {
  if (!currentEditingClip || !masterVideoElement) {
    throw new Error('No clip loaded for editing.');
  }

  const titleInput = document.getElementById('edit-clip-title');
  const startInput = document.getElementById('edit-clip-start');
  const endInput = document.getElementById('edit-clip-end');
  const cropSelect = document.getElementById('edit-clip-crop');
  const langSelect = document.getElementById('edit-clip-lang');
  const fontSizeInput = document.getElementById('edit-font-size');
  const positionSelect = document.getElementById('edit-caption-pos');

  const startTime = parseFloat(startInput?.value) || currentEditingClip.startTime;
  const endTime = parseFloat(endInput?.value) || currentEditingClip.endTime;
  const cropMode = cropSelect?.value || 'blur';
  const captionLanguage = langSelect?.value || 'hinglish';
  const fontSize = parseInt(fontSizeInput?.value, 10) || 28;
  const position = positionSelect?.value || 'bottom';

  currentEditingClip.title = titleInput?.value || currentEditingClip.title;
  currentEditingClip.startTime = startTime;
  currentEditingClip.endTime = endTime;
  currentEditingClip.duration = endTime - startTime;
  currentEditingClip.cropMode = cropMode;
  currentEditingClip.captionLanguage = captionLanguage;

  const renderOptions = {
    cropMode,
    captionLanguage,
    captionStyle: {
      fontSize,
      position,
      textColor: '#FFFFFF',
      bgColor: 'rgba(0, 0, 0, 0.75)',
      bold: true,
      wordHighlight: true,
    },
    platform: 'reels',
  };

  const rendered = await renderVerticalClip(masterVideoElement, currentEditingClip, renderOptions, onProgress);

  currentEditingClip.blobUrl = rendered.url;
  currentEditingClip.videoBlob = rendered.blob;
  currentEditingClip.format = rendered.format;

  if (onSaveCallback) {
    onSaveCallback(currentEditingClip);
  }

  closeClipEditor();
  return currentEditingClip;
}

export default {
  openClipEditor,
  closeClipEditor,
  reRenderCurrentClip,
};

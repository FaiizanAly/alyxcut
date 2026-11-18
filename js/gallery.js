// AlyxCut Generated Clips Gallery & Export Manager
// Renders clip cards, preview player, single MP4 download, and JSZip bulk packaging

import { formatDuration } from './upload.js';

/**
 * Renders the gallery of generated clips into a container
 * @param {HTMLElement} container - DOM container element
 * @param {Array} clips - Array of generated clips
 * @param {object} callbacks - { onPlay, onEdit, onDelete, onDownload }
 */
export function renderClipGallery(container, clips, callbacks = {}) {
  if (!container) return;

  if (!clips || clips.length === 0) {
    container.innerHTML = `
      <div class="empty-gallery">
        <div class="empty-icon">🎬</div>
        <h3>No Clips Generated Yet</h3>
        <p>Upload a video in the "Create Clips" tab to automatically discover and generate short videos.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  clips.forEach((clip, index) => {
    const card = document.createElement('div');
    card.className = 'clip-card';
    card.id = `card-${clip.id}`;

    // Score color coding
    const score = clip.score || 85;
    const scoreClass = score >= 90 ? 'score-high' : score >= 75 ? 'score-med' : 'score-low';

    // Badges HTML
    const badgesHtml = (clip.badges || [])
      .map((b) => `<span class="badge-chip">${b}</span>`)
      .join('');

    card.innerHTML = `
      <div class="clip-preview-wrapper">
        <video class="clip-video-player" src="${clip.blobUrl || ''}" preload="metadata" playsinline loop></video>
        <div class="video-overlay-play">
          <button class="play-btn" title="Play / Pause">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
        </div>
        <div class="score-badge ${scoreClass}">
          <span class="score-val">${score}</span>
          <span class="score-label">AI Score</span>
        </div>
        <div class="platform-tag">${clip.platform === 'shorts' ? 'Shorts' : 'Reels'} 9:16</div>
      </div>

      <div class="clip-info">
        <h4 class="clip-title" title="${escapeHtml(clip.title)}">${escapeHtml(clip.title || `Clip #${index + 1}`)}</h4>
        
        <div class="clip-meta-row">
          <span class="clip-timestamp">⏱️ ${formatDuration(clip.startTime)} - ${formatDuration(clip.endTime)}</span>
          <span class="clip-duration">(${formatDuration(clip.duration)})</span>
        </div>

        <div class="clip-badges-row">
          <span class="lang-tag">${(clip.captionLanguage || 'Hinglish').toUpperCase()}</span>
          ${badgesHtml}
        </div>

        <div class="clip-actions">
          <button class="btn-action btn-download" title="Download MP4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download
          </button>
          <button class="btn-action btn-edit" title="Edit Clip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Edit
          </button>
          <button class="btn-action btn-delete" title="Delete Clip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;

    // Event listeners
    const video = card.querySelector('.clip-video-player');
    const playBtn = card.querySelector('.play-btn');
    const overlay = card.querySelector('.video-overlay-play');
    const downloadBtn = card.querySelector('.btn-download');
    const editBtn = card.querySelector('.btn-edit');
    const deleteBtn = card.querySelector('.btn-delete');

    function togglePlay() {
      if (video.paused) {
        // Pause any other playing video
        document.querySelectorAll('.clip-video-player').forEach((v) => {
          if (v !== video) v.pause();
        });
        video.play();
        overlay.classList.add('playing');
        playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
      } else {
        video.pause();
        overlay.classList.remove('playing');
        playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
      }
    }

    video.addEventListener('click', togglePlay);
    playBtn.addEventListener('click', togglePlay);

    video.addEventListener('ended', () => {
      overlay.classList.remove('playing');
      playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    });

    downloadBtn.addEventListener('click', () => {
      downloadSingleClip(clip);
      if (callbacks.onDownload) callbacks.onDownload(clip);
    });

    editBtn.addEventListener('click', () => {
      if (callbacks.onEdit) callbacks.onEdit(clip);
    });

    deleteBtn.addEventListener('click', () => {
      if (callbacks.onDelete) callbacks.onDelete(clip);
    });

    container.appendChild(card);
  });
}

/**
 * Downloads a single clip as an MP4/WebM file
 */
export function downloadSingleClip(clip) {
  if (!clip.blobUrl && !clip.videoBlob) {
    alert('Video data is not ready for download yet.');
    return;
  }

  const filename = `AlyxCut_${sanitizeFilename(clip.title || 'clip')}_${clip.startTime}s.${clip.format || 'mp4'}`;
  const url = clip.blobUrl || URL.createObjectURL(clip.videoBlob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Bundles all clips into a single ZIP archive and triggers download
 * @param {Array} clips
 * @param {string} projectName
 * @param {Function} [onProgress]
 */
export async function downloadAllClipsAsZip(clips, projectName = 'AlyxCut', onProgress = null) {
  if (!clips || clips.length === 0) {
    throw new Error('No clips available to package into ZIP.');
  }

  // Load JSZip from package, window, or fallback
  let JSZip = window.JSZip;
  if (!JSZip) {
    try {
      const module = await import('jszip');
      JSZip = module.default || module;
    } catch {
      try {
        const module = await import('../vendor/jszip.min.js');
        JSZip = window.JSZip || module.default;
      } catch {
        const cdnModule = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
        JSZip = cdnModule.default;
      }
    }
  }

  if (!JSZip) {
    throw new Error('Could not load JSZip library for bulk download.');
  }

  const zip = new JSZip();
  const folder = zip.folder(`AlyxCut_${sanitizeFilename(projectName)}`);

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (onProgress) {
      const pct = Math.round(((i + 1) / (clips.length + 1)) * 70);
      onProgress({ percent: pct, message: `Packaging clip ${i + 1}/${clips.length} into ZIP...` });
    }

    let blob = clip.videoBlob;
    if (!blob && clip.blobUrl) {
      const resp = await fetch(clip.blobUrl);
      blob = await resp.blob();
    }

    if (blob) {
      const filename = `Clip_${i + 1}_${sanitizeFilename(clip.title || 'reel')}.${clip.format || 'mp4'}`;
      folder.file(filename, blob);
    }
  }

  if (onProgress) onProgress({ percent: 85, message: 'Compressing ZIP archive...' });

  const zipBlob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (metadata) => {
      if (onProgress) {
        onProgress({
          percent: Math.round(85 + (metadata.percent * 0.15)),
          message: `Compressing ZIP: ${Math.round(metadata.percent)}%`,
        });
      }
    }
  );

  const zipUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = zipUrl;
  a.download = `AlyxCut_${sanitizeFilename(projectName)}_Clips.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (onProgress) onProgress({ percent: 100, message: 'ZIP download initiated!' });
}

function sanitizeFilename(name) {
  return (name || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default {
  renderClipGallery,
  downloadSingleClip,
  downloadAllClipsAsZip,
};

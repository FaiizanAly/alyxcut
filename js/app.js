// AlyxCut Main Application Controller
// Orchestrates navigation, video upload, 10-stage AI processing pipeline, and storage

import { validateVideoFile, loadVideoMetadata, formatDuration, formatBytes } from './upload.js';
import { extractAudioFromVideo } from './audio-extractor.js';
import { transcribeAudio } from './speech-recognition.js';
import { sampleVideoFrames, generateCandidateClips } from './analysis.js';
import { renderVerticalClip, initFFmpeg } from './video-processor.js';
import { renderClipGallery, downloadAllClipsAsZip } from './gallery.js';
import { openClipEditor, closeClipEditor, reRenderCurrentClip } from './clip-editor.js';
import { getSettings, saveSettings, saveProject, getAllProjects, deleteProject } from './storage.js';
import { loadSettingsIntoUI, saveSettingsFromUI, preDownloadWhisperModel, clearCachedModels, clearAllLocalProjects } from './settings.js';

// Application State
const state = {
  currentView: 'dashboard',
  uploadedFile: null,
  videoMeta: null,
  currentProject: null,
  generatedClips: [],
  isProcessing: false,
  cancelRequested: false,
};

// Processing stage definitions for honest progress indicator
const STAGES = [
  { id: 1, name: 'Reading Video' },
  { id: 2, name: 'Extracting Audio' },
  { id: 3, name: 'Loading AI Model' },
  { id: 4, name: 'Transcribing Speech' },
  { id: 5, name: 'Analysing Content' },
  { id: 6, name: 'Finding Best Moments' },
  { id: 7, name: 'Generating Clips' },
  { id: 8, name: 'Adding Captions' },
  { id: 9, name: 'Rendering Videos' },
  { id: 10, name: 'Completed' },
];

/**
 * Initializes the application on DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupUploadHandlers();
  setupProcessingControls();
  setupSettingsHandlers();
  setupClipEditorHandlers();
  await loadSettingsIntoUI();
  await loadRecentProjectsDashboard();

  // Pre-initialize background FFmpeg check
  initFFmpeg().catch(() => {});
});

// ----------------- NAVIGATION -----------------

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = btn.dataset.view;
      if (targetView) {
        switchView(targetView);
      }
    });
  });

  // Quick Action Buttons
  const startUploadBtn = document.getElementById('btn-dashboard-create');
  if (startUploadBtn) {
    startUploadBtn.addEventListener('click', () => switchView('create'));
  }
}

export function switchView(viewName) {
  state.currentView = viewName;

  // Update navigation items
  document.querySelectorAll('.nav-item').forEach((item) => {
    if (item.dataset.view === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update view panels
  document.querySelectorAll('.view-panel').forEach((panel) => {
    if (panel.id === `view-${viewName}`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  // Refresh dynamic contents
  if (viewName === 'projects') {
    loadProjectsList();
  } else if (viewName === 'settings') {
    loadSettingsIntoUI();
  } else if (viewName === 'dashboard') {
    loadRecentProjectsDashboard();
  }
}

// ----------------- UPLOAD HANDLING -----------------

function setupUploadHandlers() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('video-file-input');
  const previewVideo = document.getElementById('source-preview-video');
  const removeBtn = document.getElementById('btn-remove-video');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      resetUpload();
    });
  }
}

async function handleFileSelected(file) {
  const validation = validateVideoFile(file);
  const errorEl = document.getElementById('upload-error-msg');
  const warningEl = document.getElementById('upload-warning-msg');

  if (errorEl) errorEl.textContent = '';
  if (warningEl) warningEl.textContent = '';

  if (!validation.valid) {
    if (errorEl) errorEl.textContent = validation.error;
    return;
  }

  if (validation.warning && warningEl) {
    warningEl.textContent = validation.warning;
  }

  state.uploadedFile = file;

  const previewVideo = document.getElementById('source-preview-video');
  const metaContainer = document.getElementById('video-metadata-card');
  const dropPrompt = document.getElementById('drop-prompt');

  try {
    const meta = await loadVideoMetadata(file, previewVideo);
    state.videoMeta = meta;

    // Display metadata
    document.getElementById('meta-filename').textContent = meta.name;
    document.getElementById('meta-filesize').textContent = meta.sizeFormatted;
    document.getElementById('meta-duration').textContent = meta.durationFormatted;
    document.getElementById('meta-resolution').textContent = meta.resolution;
    document.getElementById('meta-aspect').textContent = meta.aspectRatio;

    if (dropPrompt) dropPrompt.classList.add('hidden');
    if (metaContainer) metaContainer.classList.remove('hidden');

    const generateBtn = document.getElementById('btn-start-analysis');
    if (generateBtn) generateBtn.disabled = false;
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message;
    resetUpload();
  }
}

function resetUpload() {
  state.uploadedFile = null;
  state.videoMeta = null;

  const previewVideo = document.getElementById('source-preview-video');
  if (previewVideo) {
    previewVideo.pause();
    previewVideo.src = '';
  }

  const dropPrompt = document.getElementById('drop-prompt');
  const metaContainer = document.getElementById('video-metadata-card');
  const generateBtn = document.getElementById('btn-start-analysis');
  const fileInput = document.getElementById('video-file-input');

  if (dropPrompt) dropPrompt.classList.remove('hidden');
  if (metaContainer) metaContainer.classList.add('hidden');
  if (generateBtn) generateBtn.disabled = true;
  if (fileInput) fileInput.value = '';
}

// ----------------- PROCESSING PIPELINE -----------------

function setupProcessingControls() {
  const startBtn = document.getElementById('btn-start-analysis');
  const cancelBtn = document.getElementById('btn-cancel-processing');
  const downloadAllBtn = document.getElementById('btn-download-all-zip');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      startProcessingPipeline();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      state.cancelRequested = true;
      updateProcessingUI(0, 'Cancelling processing...', 'Cleaning up memory resources...');
    });
  }

  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', async () => {
      const prjName = state.currentProject?.name || state.videoMeta?.name || 'Project';
      const statusEl = document.getElementById('zip-status-indicator');
      try {
        downloadAllBtn.disabled = true;
        await downloadAllClipsAsZip(state.generatedClips, prjName, (p) => {
          if (statusEl) statusEl.textContent = p.message;
        });
        if (statusEl) statusEl.textContent = '✅ ZIP downloaded successfully.';
      } catch (err) {
        alert(`ZIP generation failed: ${err.message}`);
      } finally {
        downloadAllBtn.disabled = false;
      }
    });
  }
}

async function startProcessingPipeline() {
  if (!state.uploadedFile || !state.videoMeta) {
    alert('Please select a video file first.');
    return;
  }

  state.isProcessing = true;
  state.cancelRequested = false;

  const processModal = document.getElementById('processing-overlay');
  if (processModal) processModal.classList.add('active');

  const settings = await getSettings();
  const previewVideo = document.getElementById('source-preview-video');

  try {
    // ----------------- STAGE 1: Reading Video -----------------
    setProcessingStage(1, 'Reading video container and checking streams...', 5);
    checkCancellation();

    // ----------------- STAGE 2: Extracting Audio -----------------
    setProcessingStage(2, 'Extracting 16kHz audio stream via Web Audio API...', 15);
    checkCancellation();

    const audioResult = await extractAudioFromVideo(state.uploadedFile, (p) => {
      setProcessingProgress(Math.round(15 + p.percent * 0.15), p.message);
    });
    checkCancellation();

    // ----------------- STAGE 3: Loading AI Model -----------------
    setProcessingStage(3, 'Loading local Whisper AI speech recognition model...', 30);
    checkCancellation();

    // ----------------- STAGE 4: Transcribing Speech -----------------
    setProcessingStage(4, 'Transcribing spoken audio into timestamped speech chunks...', 40);
    checkCancellation();

    const transcriptResult = await transcribeAudio(audioResult.audioData, {
      language: settings.captionLanguage === 'english' ? 'english' : null,
      onProgress: (p) => {
        setProcessingProgress(Math.round(40 + p.percent * 0.20), p.message);
      },
    });
    checkCancellation();

    // ----------------- STAGE 5: Analysing Content -----------------
    setProcessingStage(5, 'Analysing visual frames, scene cuts, and speech flow...', 62);
    checkCancellation();

    const visualData = await sampleVideoFrames(previewVideo, 2, (p) => {
      setProcessingProgress(Math.round(62 + p.percent * 0.08), p.message);
    });
    checkCancellation();

    // ----------------- STAGE 6: Finding Best Moments -----------------
    setProcessingStage(6, 'Scoring hooks, emotional cues, completeness & engagement...', 72);
    checkCancellation();

    const candidateClips = generateCandidateClips(transcriptResult.chunks, state.videoMeta.durationSec, {
      targetDuration: settings.clipDuration,
      clipCount: settings.clipCount,
      visualData,
    });

    if (candidateClips.length === 0) {
      throw new Error('No suitable moments could be identified from this video.');
    }
    checkCancellation();

    // ----------------- STAGE 7: Generating Clips -----------------
    setProcessingStage(7, `Selected ${candidateClips.length} highest-scoring moments...`, 78);
    checkCancellation();

    // ----------------- STAGE 8: Adding Captions -----------------
    setProcessingStage(8, 'Formatting synchronized Hinglish captions...', 82);
    checkCancellation();

    // ----------------- STAGE 9: Rendering Videos -----------------
    setProcessingStage(9, 'Rendering 9:16 vertical videos with blurred background...', 85);
    const renderedClips = [];

    for (let i = 0; i < candidateClips.length; i++) {
      checkCancellation();
      const clip = candidateClips[i];

      setProcessingProgress(
        Math.round(85 + ((i + 1) / candidateClips.length) * 12),
        `Rendering Clip ${i + 1}/${candidateClips.length}: "${clip.title}"`
      );

      const renderResult = await renderVerticalClip(
        previewVideo,
        clip,
        {
          cropMode: settings.cropMode,
          captionLanguage: settings.captionLanguage,
          captionStyle: settings.captionStyle,
          platform: settings.platform,
        },
        (p) => {
          setProcessingSubProgress(p.percent, p.message);
        }
      );

      clip.blobUrl = renderResult.url;
      clip.videoBlob = renderResult.blob;
      clip.format = renderResult.format;
      clip.cropMode = settings.cropMode;
      clip.captionLanguage = settings.captionLanguage;
      clip.platform = settings.platform;

      renderedClips.push(clip);
    }

    // ----------------- STAGE 10: Completed -----------------
    setProcessingStage(10, 'All clips successfully generated!', 100);

    state.generatedClips = renderedClips;

    // Save to Project History
    const project = {
      id: `proj_${Date.now()}`,
      name: state.videoMeta.name.replace(/\.[^/.]+$/, ''),
      videoMeta: state.videoMeta,
      transcript: transcriptResult,
      clips: renderedClips,
      createdAt: new Date().toISOString(),
    };
    state.currentProject = project;
    await saveProject(project);

    // Hide Processing Modal
    setTimeout(() => {
      if (processModal) processModal.classList.remove('active');
      displayResults(renderedClips);
    }, 1200);

  } catch (err) {
    if (state.cancelRequested) {
      alert('Video processing was cancelled.');
    } else {
      console.error('Processing error:', err);
      alert(`Processing error: ${err.message}`);
    }
    if (processModal) processModal.classList.remove('active');
  } finally {
    state.isProcessing = false;
    state.cancelRequested = false;
  }
}

function checkCancellation() {
  if (state.cancelRequested) {
    throw new Error('Processing cancelled by user.');
  }
}

function setProcessingStage(stageIndex, message, percent) {
  const stageNameEl = document.getElementById('process-stage-name');
  const stageNumberEl = document.getElementById('process-stage-num');
  const progressBar = document.getElementById('process-progress-bar');
  const percentText = document.getElementById('process-percent-text');
  const statusMsgEl = document.getElementById('process-status-detail');

  const stage = STAGES.find((s) => s.id === stageIndex) || { name: 'Processing' };

  if (stageNameEl) stageNameEl.textContent = stage.name;
  if (stageNumberEl) stageNumberEl.textContent = `Stage ${stageIndex} of 10`;
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (percentText) percentText.textContent = `${percent}%`;
  if (statusMsgEl) statusMsgEl.textContent = message;

  // Update step indicators
  document.querySelectorAll('.stage-step-item').forEach((item) => {
    const idx = parseInt(item.dataset.step, 10);
    if (idx < stageIndex) {
      item.className = 'stage-step-item completed';
    } else if (idx === stageIndex) {
      item.className = 'stage-step-item active';
    } else {
      item.className = 'stage-step-item pending';
    }
  });
}

function setProcessingProgress(percent, message) {
  const progressBar = document.getElementById('process-progress-bar');
  const percentText = document.getElementById('process-percent-text');
  const statusMsgEl = document.getElementById('process-status-detail');

  if (progressBar) progressBar.style.width = `${percent}%`;
  if (percentText) percentText.textContent = `${percent}%`;
  if (statusMsgEl && message) statusMsgEl.textContent = message;
}

function setProcessingSubProgress(percent, message) {
  const subMsgEl = document.getElementById('process-sub-status');
  if (subMsgEl) subMsgEl.textContent = `${message} (${percent}%)`;
}

// ----------------- RESULTS & GALLERY -----------------

function displayResults(clips) {
  const gallerySection = document.getElementById('generated-gallery-section');
  const galleryContainer = document.getElementById('clips-gallery-grid');
  const clipCountHeader = document.getElementById('gallery-clip-count');

  if (gallerySection) gallerySection.classList.remove('hidden');
  if (clipCountHeader) clipCountHeader.textContent = `${clips.length} Clips Generated`;

  renderClipGallery(galleryContainer, clips, {
    onEdit: (clip) => {
      const previewVideo = document.getElementById('source-preview-video');
      openClipEditor(clip, state.currentProject, previewVideo, (updatedClip) => {
        // Replace updated clip in state
        const idx = state.generatedClips.findIndex((c) => c.id === updatedClip.id);
        if (idx !== -1) {
          state.generatedClips[idx] = updatedClip;
          displayResults(state.generatedClips);
        }
      });
    },
    onDelete: (clip) => {
      if (confirm(`Delete clip "${clip.title}"?`)) {
        state.generatedClips = state.generatedClips.filter((c) => c.id !== clip.id);
        displayResults(state.generatedClips);
      }
    },
  });

  // Scroll to gallery
  gallerySection?.scrollIntoView({ behavior: 'smooth' });
}

// ----------------- PROJECTS HISTORY -----------------

async function loadProjectsList() {
  const container = document.getElementById('projects-list-container');
  if (!container) return;

  const projects = await getAllProjects();

  if (projects.length === 0) {
    container.innerHTML = `
      <div class="empty-gallery">
        <div class="empty-icon">📁</div>
        <h3>No Saved Projects</h3>
        <p>Your generated video projects will be saved locally on this computer.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  projects.forEach((proj) => {
    const card = document.createElement('div');
    card.className = 'project-row-card';

    const dateStr = new Date(proj.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const clipCount = proj.clips?.length || 0;
    const duration = proj.videoMeta?.durationFormatted || 'N/A';

    card.innerHTML = `
      <div class="proj-left">
        <div class="proj-icon">🎥</div>
        <div class="proj-meta">
          <h4 class="proj-title">${proj.name}</h4>
          <span class="proj-sub">Source Duration: ${duration} • ${clipCount} Clips Generated • ${dateStr}</span>
        </div>
      </div>
      <div class="proj-actions">
        <button class="btn-action btn-open-proj">Open Clips</button>
        <button class="btn-action btn-del-proj" title="Delete Project">🗑️</button>
      </div>
    `;

    card.querySelector('.btn-open-proj').addEventListener('click', () => {
      state.currentProject = proj;
      state.generatedClips = proj.clips || [];
      switchView('create');
      displayResults(state.generatedClips);
    });

    card.querySelector('.btn-del-proj').addEventListener('click', async () => {
      if (confirm(`Delete project "${proj.name}"?`)) {
        await deleteProject(proj.id);
        await loadProjectsList();
      }
    });

    container.appendChild(card);
  });
}

async function loadRecentProjectsDashboard() {
  const container = document.getElementById('dashboard-recent-projects');
  if (!container) return;

  const projects = await getAllProjects();

  if (projects.length === 0) {
    container.innerHTML = '<p class="text-muted">No recent projects yet. Upload a video to get started.</p>';
    return;
  }

  container.innerHTML = '';
  projects.slice(0, 3).forEach((p) => {
    const item = document.createElement('div');
    item.className = 'recent-proj-item';
    item.innerHTML = `
      <span class="recent-name">🎬 ${p.name}</span>
      <span class="recent-clips">${p.clips?.length || 0} clips</span>
    `;
    item.addEventListener('click', () => {
      state.currentProject = p;
      state.generatedClips = p.clips || [];
      switchView('create');
      displayResults(state.generatedClips);
    });
    container.appendChild(item);
  });
}

// ----------------- SETTINGS & CLIP EDITOR HANDLERS -----------------

function setupSettingsHandlers() {
  const saveBtn = document.getElementById('btn-save-settings');
  const predownloadBtn = document.getElementById('btn-predownload-model');
  const clearCacheBtn = document.getElementById('btn-clear-model-cache');
  const clearStorageBtn = document.getElementById('btn-clear-all-storage');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      await saveSettingsFromUI();
      alert('Settings saved successfully!');
    });
  }

  if (predownloadBtn) {
    predownloadBtn.addEventListener('click', async () => {
      try {
        predownloadBtn.disabled = true;
        await preDownloadWhisperModel();
        alert('Whisper AI model successfully downloaded and cached in your browser!');
      } catch (err) {
        alert(`Failed to download model: ${err.message}`);
      } finally {
        predownloadBtn.disabled = false;
      }
    });
  }

  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', async () => {
      if (confirm('Clear locally cached AI models? You will need an internet connection to re-download them.')) {
        await clearCachedModels();
        alert('AI Model cache cleared.');
      }
    });
  }

  if (clearStorageBtn) {
    clearStorageBtn.addEventListener('click', async () => {
      if (confirm('Clear all saved project data from this computer? This cannot be undone.')) {
        await clearAllLocalProjects();
        alert('Local storage data cleared.');
        await loadProjectsList();
      }
    });
  }
}

function setupClipEditorHandlers() {
  const closeBtn = document.getElementById('btn-close-editor');
  const saveBtn = document.getElementById('btn-rerender-clip');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeClipEditor());
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const statusEl = document.getElementById('edit-render-status');
      try {
        saveBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Re-rendering clip...';

        await reRenderCurrentClip((p) => {
          if (statusEl) statusEl.textContent = p.message;
        });

        alert('Clip re-rendered successfully!');
      } catch (err) {
        alert(`Re-rendering failed: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        if (statusEl) statusEl.textContent = '';
      }
    });
  }
}

export default {
  switchView,
  startProcessingPipeline,
};

// AlyxCut AI Video Analysis & Smart Clip Scoring Engine
// Analyzes full video transcripts and sampled video frames
// Zero external APIs, explainable transparent scoring, natural boundaries

/**
 * High-value hook phrases in Hindi/Hinglish and English
 */
const HOOK_PATTERNS = [
  /kya\s+aap/i,
  /kya\s+apko\s+pata/i,
  /did\s+you\s+know/i,
  /how\s+to/i,
  /why\s+do/i,
  /what\s+if/i,
  /sabse\s+bada/i,
  /sabse\s+pehle/i,
  /secret/i,
  /raaz/i,
  /galti/i,
  /mistake/i,
  /ruko/i,
  /wait/i,
  /listen/i,
  /dhyan\s+se/i,
  /dekho/i,
  /watch\s+this/i,
  /never/i,
  /kabhi\s+bhi/i,
  /shocking/i,
  /amazing/i,
  /crazy/i,
  /the\s+truth/i,
  /asliyat/i,
  /ek\s+aisi/i,
  /don't\s+do\s+this/i,
  /ye\s+mat\s+karna/i,
];

/**
 * Educational, storytelling and high-engagement keywords
 */
const CONTENT_PATTERNS = [
  /step/i, /tarika/i, /solution/i, /fayda/i, /problem/i,
  /reason/i, /kyunki/i, /because/i, /example/i, /kaise\s+kare/i,
  /technology/i, /feature/i, /tips/i, /tricks/i, /result/i,
  /story/i, /kahani/i, /experience/i, /anubhav/i, /important/i,
  /zaroori/i, /formula/i, /concept/i, /learn/i, /seekhe/i,
];

/**
 * Samples video frames to detect scene cuts and optimal visual center
 * @param {HTMLVideoElement} videoElement
 * @param {number} sampleIntervalSec
 * @param {Function} [onProgress]
 * @returns {Promise<Array<{ time: number, sceneCut: boolean, focalX: number }>>}
 */
export async function sampleVideoFrames(videoElement, sampleIntervalSec = 2, onProgress = null) {
  const duration = videoElement.duration || 0;
  if (!duration || duration <= 0) return [];

  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 90;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const visualData = [];
  let previousFrameData = null;

  // Non-blocking sampling: Cap at max 35 sample frames across any video length (at least 2.5s apart)
  const maxSamples = 35;
  const effectiveInterval = Math.max(2.5, duration / maxSamples);
  const totalSamples = Math.ceil(duration / effectiveInterval);
  let sampleCount = 0;

  // Check if native FaceDetector is available in this browser
  let faceDetector = null;
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
    } catch {
      faceDetector = null;
    }
  }

  for (let time = 0; time < duration; time += effectiveInterval) {
    sampleCount++;
    if (onProgress && totalSamples > 0) {
      const pct = Math.min(100, Math.round((sampleCount / totalSamples) * 100));
      onProgress({ percent: pct, message: `Analyzing visual frames (${sampleCount}/${totalSamples})...` });
    }

    // Yield execution to the browser main thread to guarantee 60fps UI responsiveness
    await new Promise((resolve) => setTimeout(resolve, 16));

    // Seek video to sample time
    await seekVideo(videoElement, time);

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 1. Calculate frame difference for scene cut detection
    let diff = 0;
    if (previousFrameData) {
      let pixelDiffSum = 0;
      for (let i = 0; i < data.length; i += 4) {
        pixelDiffSum += Math.abs(data[i] - previousFrameData[i]); // R
        pixelDiffSum += Math.abs(data[i + 1] - previousFrameData[i + 1]); // G
        pixelDiffSum += Math.abs(data[i + 2] - previousFrameData[i + 2]); // B
      }
      diff = pixelDiffSum / (data.length * 0.75 * 255);
    }
    previousFrameData = data;
    const isSceneCut = diff > 0.25;

    // 2. Determine focal horizontal position (0.0 to 1.0)
    let focalX = 0.5; // default center

    if (faceDetector) {
      try {
        const faces = await faceDetector.detect(canvas);
        if (faces && faces.length > 0) {
          // Use largest face center
          let maxArea = 0;
          for (const face of faces) {
            const area = face.boundingBox.width * face.boundingBox.height;
            if (area > maxArea) {
              maxArea = area;
              focalX = (face.boundingBox.x + face.boundingBox.width / 2) / canvas.width;
            }
          }
        }
      } catch {
        // Fallback to skin tone / center of mass
      }
    }

    if (focalX === 0.5) {
      // Contrast / skin tone heuristic
      let leftWeight = 0;
      let centerWeight = 0;
      let rightWeight = 0;
      const wThird = canvas.width / 3;

      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Simple skin tone / warmth indicator: R > G and G > B
          const isWarm = r > 90 && g > 40 && b > 20 && r > g && g > b && (r - g) > 15;
          if (isWarm) {
            if (x < wThird) leftWeight++;
            else if (x < wThird * 2) centerWeight += 1.5;
            else rightWeight++;
          }
        }
      }

      if (leftWeight > centerWeight * 1.4 && leftWeight > rightWeight) focalX = 0.35;
      else if (rightWeight > centerWeight * 1.4 && rightWeight > leftWeight) focalX = 0.65;
      else focalX = 0.5;
    }

    visualData.push({
      time: Number(time.toFixed(1)),
      sceneCut: isSceneCut,
      focalX: Number(focalX.toFixed(2)),
    });
  }

  return visualData;
}

/**
 * Seeks video element with Promise resolution
 */
function seekVideo(video, time) {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = Math.min(time, video.duration - 0.05);
  });
}

/**
 * Scores a candidate video clip based on hook, completeness, speech density and content
 * @param {Array} candidateChunks - Transcript chunks within candidate window
 * @param {number} startTime
 * @param {number} endTime
 * @param {Array} visualData - Sampled frame data
 * @returns {object} - Score, badges, and breakdown
 */
export function scoreCandidateClip(candidateChunks, startTime, endTime, visualData = []) {
  const duration = endTime - startTime;
  if (duration < 5) return { score: 0, badges: [], breakdown: {} };

  const fullText = candidateChunks.map((c) => c.hinglish || c.text || '').join(' ').trim();
  const firstChunk = candidateChunks[0] ? (candidateChunks[0].hinglish || candidateChunks[0].text || '') : '';

  // 1. Hook Score (0 - 30 points)
  let hookScore = 10;
  const badges = [];

  for (const pattern of HOOK_PATTERNS) {
    if (pattern.test(firstChunk) || pattern.test(fullText.slice(0, 100))) {
      hookScore = 28;
      badges.push('Strong Hook');
      break;
    }
  }

  // Question hook
  if (/[?？]/.test(firstChunk) || /kya|why|how|kaise/i.test(firstChunk)) {
    hookScore = Math.max(hookScore, 26);
    if (!badges.includes('Curiosity Hook')) badges.push('Curiosity Hook');
  }

  // 2. Completeness & Boundary Score (0 - 25 points)
  let completenessScore = 15;
  const lastChunk = candidateChunks[candidateChunks.length - 1];
  const lastText = lastChunk ? (lastChunk.hinglish || lastChunk.text || '') : '';

  // Check if ends cleanly with period, question, or exclamation
  if (/[.!?।]/.test(lastText.slice(-3)) || (lastChunk && endTime - lastChunk.end > 0.3)) {
    completenessScore = 24;
    badges.push('Complete Thought');
  } else {
    // Slight penalty if truncated mid-sentence
    completenessScore = 12;
  }

  // 3. Speech Density Score (0 - 25 points)
  let speechDuration = 0;
  for (const chunk of candidateChunks) {
    speechDuration += (chunk.end - chunk.start);
  }
  const speechRatio = duration > 0 ? speechDuration / duration : 0;
  let speechDensityScore = 15;

  if (speechRatio >= 0.70 && speechRatio <= 0.95) {
    speechDensityScore = 25;
    badges.push('High Flow');
  } else if (speechRatio >= 0.50) {
    speechDensityScore = 20;
  } else {
    // Too much silence
    speechDensityScore = 10;
  }

  // 4. Content Value & Engagement (0 - 20 points)
  let contentScore = 8;
  let matchCount = 0;

  for (const pattern of CONTENT_PATTERNS) {
    if (pattern.test(fullText)) {
      matchCount++;
    }
  }

  if (matchCount >= 3) {
    contentScore = 19;
    badges.push('High Value');
  } else if (matchCount >= 1) {
    contentScore = 15;
    badges.push('Engaging');
  }

  // Visual stability / focal point recommendation
  let avgFocalX = 0.5;
  if (visualData && visualData.length > 0) {
    const relevantFrames = visualData.filter((f) => f.time >= startTime && f.time <= endTime);
    if (relevantFrames.length > 0) {
      const sumFocal = relevantFrames.reduce((acc, f) => acc + f.focalX, 0);
      avgFocalX = sumFocal / relevantFrames.length;
    }
  }

  const totalScore = Math.min(99, Math.round(hookScore + completenessScore + speechDensityScore + contentScore));

  return {
    score: totalScore,
    badges: badges.slice(0, 3),
    focalX: Number(avgFocalX.toFixed(2)),
    breakdown: {
      hookScore,
      completenessScore,
      speechDensityScore,
      contentScore,
    },
  };
}

/**
 * Automatically discovers, ranks, and returns candidate clips across the full video
 * @param {Array} chunks - Processed transcript chunks
 * @param {number} totalDuration - Total video duration in seconds
 * @param {object} options
 * @param {string|number} [options.targetDuration] - 'auto' | 15 | 30 | 45 | 60 | custom
 * @param {string|number} [options.clipCount] - 'auto' | 5 | 10 | 15 | custom
 * @param {Array} [options.visualData] - Visual sampling data
 * @returns {Array<object>} - Ranked clips
 */
export function generateCandidateClips(chunks, totalDuration, options = {}) {
  const { targetDuration = 'auto', clipCount = 'auto', visualData = [] } = options;

  if (!chunks || chunks.length === 0 || totalDuration < 10) {
    // If no transcript chunks were detected (e.g. video without dialogue), divide into visual scenes
    return generateFallbackClips(totalDuration, targetDuration, clipCount, visualData);
  }

  // Determine ideal duration window in seconds
  let minDuration = 15;
  let maxDuration = 45;
  let nominalDuration = 30;

  if (targetDuration === 15) {
    minDuration = 12;
    maxDuration = 20;
    nominalDuration = 15;
  } else if (targetDuration === 30) {
    minDuration = 22;
    maxDuration = 36;
    nominalDuration = 30;
  } else if (targetDuration === 45) {
    minDuration = 35;
    maxDuration = 52;
    nominalDuration = 45;
  } else if (targetDuration === 60) {
    minDuration = 45;
    maxDuration = 65;
    nominalDuration = 60;
  } else if (typeof targetDuration === 'number') {
    minDuration = Math.max(10, targetDuration - 5);
    maxDuration = targetDuration + 10;
    nominalDuration = targetDuration;
  }

  const candidates = [];

  // Slide through chunks to find natural start candidates
  for (let i = 0; i < chunks.length; i++) {
    const startChunk = chunks[i];
    const startTime = Math.max(0, startChunk.start);

    // Look for natural end chunk within target duration range
    for (let j = i; j < chunks.length; j++) {
      const endChunk = chunks[j];
      const endTime = Math.min(totalDuration, endChunk.end);
      const currentDuration = endTime - startTime;

      if (currentDuration >= minDuration && currentDuration <= maxDuration) {
        const candidateChunks = chunks.slice(i, j + 1);
        const scoring = scoreCandidateClip(candidateChunks, startTime, endTime, visualData);

        // Generate a concise title from the opening hook or first chunk
        const rawTitle = (startChunk.hinglish || startChunk.text || `Clip ${candidates.length + 1}`).trim();
        const cleanTitle = rawTitle.slice(0, 45) + (rawTitle.length > 45 ? '...' : '');

        candidates.push({
          id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: cleanTitle,
          startTime: Number(startTime.toFixed(2)),
          endTime: Number(endTime.toFixed(2)),
          duration: Number(currentDuration.toFixed(2)),
          score: scoring.score,
          badges: scoring.badges,
          breakdown: scoring.breakdown,
          focalX: scoring.focalX,
          chunks: candidateChunks,
        });
      } else if (currentDuration > maxDuration) {
        break; // exceed window, move startChunk forward
      }
    }
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Non-overlapping selection
  const selectedClips = [];
  const minGapBetweenClips = 3; // 3 seconds spacing

  for (const candidate of candidates) {
    const overlaps = selectedClips.some((sel) => {
      return (
        (candidate.startTime >= sel.startTime - minGapBetweenClips && candidate.startTime <= sel.endTime + minGapBetweenClips) ||
        (candidate.endTime >= sel.startTime - minGapBetweenClips && candidate.endTime <= sel.endTime + minGapBetweenClips) ||
        (candidate.startTime <= sel.startTime && candidate.endTime >= sel.endTime)
      );
    });

    if (!overlaps) {
      selectedClips.push(candidate);
    }
  }

  // Determine requested count
  let desiredCount = 5;
  if (clipCount === 'auto') {
    // 1 clip per ~45-60 seconds of video, minimum 1, maximum 10
    desiredCount = Math.max(1, Math.min(10, Math.floor(totalDuration / 45)));
  } else if (typeof clipCount === 'number') {
    desiredCount = clipCount;
  }

  const finalClips = selectedClips.slice(0, desiredCount);

  // Re-sort final clips chronologically for pleasant review
  finalClips.sort((a, b) => a.startTime - b.startTime);

  return finalClips;
}

/**
 * Fallback clip generator when no spoken dialogue is detected
 */
function generateFallbackClips(totalDuration, targetDuration, clipCount, visualData = []) {
  const duration = targetDuration === 15 ? 15 : targetDuration === 45 ? 45 : targetDuration === 60 ? 60 : 30;
  let count = clipCount === 'auto' ? Math.max(1, Math.min(5, Math.floor(totalDuration / duration))) : Number(clipCount) || 3;

  const clips = [];
  const interval = totalDuration / (count + 1);

  for (let i = 1; i <= count; i++) {
    const center = i * interval;
    const start = Math.max(0, center - duration / 2);
    const end = Math.min(totalDuration, start + duration);

    clips.push({
      id: `clip_${Date.now()}_${i}`,
      title: `Moment ${i}`,
      startTime: Number(start.toFixed(2)),
      endTime: Number(end.toFixed(2)),
      duration: Number((end - start).toFixed(2)),
      score: 80,
      badges: ['Visual Highlight'],
      breakdown: { hookScore: 20, completenessScore: 20, speechDensityScore: 20, contentScore: 20 },
      focalX: 0.5,
      chunks: [],
    });
  }

  return clips;
}

export default {
  sampleVideoFrames,
  scoreCandidateClip,
  generateCandidateClips,
};

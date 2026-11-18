# ⚡ AlyxCut — AI-Powered Reels & Shorts Generator

> **Long Videos. Smart Clips. Automatically.**  
> An **AlyxFai** Product • Free, Open-Source & 100% Client-Side Private

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Web-blue.svg)]()
[![Zero Cost](https://img.shields.io/badge/Cost-$0%20(No%20API%20Keys)-success.svg)]()
[![Whisper AI](https://img.shields.io/badge/AI-Transformers.js%20(Whisper)-orange.svg)]()

---

## 📖 Introduction

**AlyxCut** is a free, local-first AI video tool that automatically transforms full-length offline videos into ready-to-publish vertical **Instagram Reels** and **YouTube Shorts**.

Unlike expensive cloud services that require monthly subscriptions and upload your private footage to external servers, **AlyxCut runs 100% locally inside your desktop browser on Windows**. 

Using browser-accelerated **Whisper AI** and lightweight computer vision, AlyxCut analyzes spoken dialogue, detects opening hooks and emotional peaks, eliminates dead silence, generates synchronized **Hinglish (Roman Hindi)** captions, and renders vertical 9:16 clips with blurred background or smart face cropping.

---
[Visit alyxcut LIVE SITE](https://alyxcut-swart.vercel.app/)
---

## ✨ Key Features

- 🤖 **Zero-Cost Local Whisper AI**  
  No OpenAI keys or third-party APIs needed. Runs local multilingual Whisper via `@huggingface/transformers` with WebGPU acceleration and automatic multi-threaded WASM fallback.
  
- 🇮🇳 **Intelligent Hinglish Captions (Default)**  
  Built-in phonetic transliteration engine converts spoken Hindi Devanagari into natural Roman Hindi (Hinglish), e.g.:
  > Spoken: *"आज हम एक नई टेक्नोलॉजी के बारे में जानेंगे।"*  
  > Caption: *"Aaj hum ek nayi technology ke baare mein jaanenge."*

- 🌐 **Three Caption Languages**  
  1. **Hinglish (Roman Hindi)** — Default for high-engagement Indian social media.
  2. **Hindi (Devanagari)** — For traditional Hindi viewers.
  3. **English** — For global audiences.

- 🎯 **Explainable AI Moment Scoring**  
  Clips are evaluated on a transparent 100-point rubric:
  - **Hook Score (30%)**: Detects questions, curiosity triggers, and energetic openings.
  - **Completeness Score (25%)**: Aligns strictly to natural sentence boundaries (no awkward mid-word cuts).
  - **Speech Density (20%)**: Eliminates pauses, stutters, and dead air.
  - **Content Value (15%)**: Identifies educational steps, tips, and emotional stories.
  - **Visual Stability (10%)**: Analyzes scene cuts and subject framing.

- 📱 **Automatic 9:16 Vertical Video Compositor**  
  - **Blurred Background (Default)**: Duplicates and applies dynamic Gaussian blur to fill the 9:16 canvas, overlaying the sharp source video with cinematic drop shadow.
  - **Smart Center / Subject Crop**: Crops horizontal video using facial center-of-gravity.
  - **Fit Mode**: Preserves original framing with clean letterbox borders.

- ✏️ **Built-in Clip & Caption Editor**  
  Adjust start/end trim points, correct words in transliterated captions, adjust font size or position (bottom, center, top), and re-render in seconds.

- 📦 **One-Click MP4 & Bulk ZIP Export**  
  Download individual clips as `.mp4` or package all clips into an organized ZIP archive with `JSZip`.

- 🔒 **100% Private & Offline-Capable**  
  Videos and transcripts never touch an application server. Downloaded models are cached in browser `IndexedDB`/`CacheStorage` for offline reuse.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | HTML5, CSS3, ES Modules | Zero-runtime UI, high performance, beginner-friendly |
| **Speech Recognition** | Transformers.js (Whisper-Tiny) | 100% in-browser speech-to-text with WebGPU & WASM |
| **Transliteration** | Native Phonetic Transliteration Engine | Devanagari to Roman Hinglish conversion |
| **Video Processing** | Canvas API + MediaRecorder + FFmpeg.wasm | 9:16 vertical formatting, blurred background & burned subtitles |
| **Bulk Packaging** | JSZip | Client-side ZIP generation |
| **Storage** | IndexedDB | Local project history and model caching |
| **Dev & Deployment** | Pure Node.js Dev Server / Vercel Free Tier | Zero native C++ dependency, COOP/COEP isolation headers |

---

## 📂 Project Structure

```text
alyxcut/
│
├── index.html              # Main single-page application UI
├── package.json            # Project metadata and dependencies
├── dev-server.js           # Lightweight development server with COOP/COEP headers
├── build.js                # Production static packaging script for Vercel/GitHub
├── vercel.json             # Vercel configuration with required isolation headers
├── .gitignore              # Git ignore rules
├── README.md               # Documentation & usage guide
│
├── css/
│   ├── style.css           # Modern charcoal dark theme with crimson red accents
│   └── responsive.css      # Desktop, laptop, and tablet responsive adjustments
│
├── js/
│   ├── app.js              # Central pipeline controller and view manager
│   ├── upload.js           # Video drag-and-drop, metadata parser, and memory validation
│   ├── transliterate.js    # Rule-based phonetic Hindi-to-Hinglish transliterator
│   ├── audio-extractor.js  # 16kHz mono Float32Array PCM audio extractor (Web Audio)
│   ├── speech-recognition.js# Transformers.js Whisper speech recognition module
│   ├── analysis.js         # Full-video scene cut detection & smart clip scoring
│   ├── video-processor.js  # 9:16 vertical canvas compositor & burned subtitle renderer
│   ├── clip-editor.js      # Modal trim, caption text editor, and re-rendering
│   ├── gallery.js          # Clip cards, video preview player, single & ZIP download
│   ├── storage.js          # IndexedDB persistence for projects and settings
│   └── settings.js         # User preference controls and hardware diagnostics
│
├── vendor/                 # Vendored browser-compatible client-side libraries
│   ├── jszip.min.js
│   ├── transformers.web.min.js
│   └── ffmpeg/
│
├── assets/
│   └── samples/
│       └── sample_demo.mp4 # Test video for validation
│
└── tests/
    ├── transliterate.test.js # Transliteration engine unit tests
    ├── analysis.test.js      # Scoring & clip generation unit tests
    └── upload.test.js        # File validation & duration formatting tests
```

---

## 🚀 Getting Started

### Prerequisites

- A modern desktop browser: **Google Chrome**, **Microsoft Edge**, **Brave**, or **Firefox** (Chromium browsers recommended for WebGPU).
- **Node.js** v18+ (tested on v26 on Windows 11/10).

### Installation

1. Clone or download the repository:
   ```bash
   git clone https://github.com/your-username/alyxcut.git
   cd alyxcut
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the automated test suite:
   ```bash
   npm test
   ```

4. Start the local server:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 🎬 How to Use AlyxCut

1. **Upload Video**: In the **Create Clips** tab, drag and drop an offline MP4, MOV, WebM, MKV, or AVI video.
2. **Review Metadata**: Check the duration, resolution, and aspect ratio in the preview card.
3. **Choose Preferences**:
   - **Caption Language**: Select *Hinglish (Roman Hindi)*, *Hindi*, or *English*.
   - **Duration**: Choose *Automatic*, *15s*, *30s*, *45s*, or *60s*.
   - **Crop Style**: Choose *Blurred Background 9:16* or *Smart Center Crop*.
4. **Click "Generate Smart Clips"**:
   - Watch the transparent 10-stage progress bar:
     `Reading Video` ➔ `Extracting Audio` ➔ `Loading AI Model` ➔ `Transcribing Speech` ➔ `Analysing Content` ➔ `Finding Best Moments` ➔ `Generating Clips` ➔ `Adding Captions` ➔ `Rendering Videos` ➔ `Completed`.
5. **Preview & Edit**:
   - Play clips directly in the results gallery.
   - Click **Edit** to adjust start/end timestamps or correct any caption spelling.
6. **Download**:
   - Click **Download** on any clip for an instant MP4 file.
   - Click **Download All (ZIP)** to receive all generated clips in a single package.

---

## ⚡ Hardware Recommendations & Diagnostics

AlyxCut includes a built-in **Diagnostics Table** in the *Settings* tab:

| Feature | Recommended | Fallback |
|---|---|---|
| **GPU** | Discrete or modern Integrated GPU with **WebGPU** support | Multi-threaded CPU via WASM |
| **CPU** | 4+ physical cores (Intel i5/i7/i9, AMD Ryzen 5/7/9) | Dual-core minimum |
| **RAM** | 8 GB+ (16 GB recommended for 1080p source videos) | 4 GB |
| **Browser** | Chrome 113+ or Edge 113+ (for WebGPU and ShapeDetection) | Any modern standards-compliant browser |

---

## 🚢 Free Deployment to Vercel

AlyxCut is configured for zero-cost static deployment to Vercel.

1. Build the production distribution:
   ```bash
   npm run build
   ```
2. The `vercel.json` file automatically applies the required cross-origin isolation headers:
   ```json
   {
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
           { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
         ]
       }
     ]
   }
   ```
3. Deploy directly using the Vercel CLI or by connecting your GitHub repository:
   ```bash
   npx vercel deploy --prod
   ```

---

## 🔒 Privacy & Security

- **100% Client-Side**: No video files or transcripts are ever transmitted across the internet.
- **No API Keys**: You never have to input credit cards or secret API tokens.
- **Auditable**: All source code is vanilla JavaScript with zero obfuscation.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.

Developed with ❤️ by **AlyxFai** (makers of *AlyxFiles*).

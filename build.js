// AlyxCut Production Build Script
// Packages all static assets, JS modules, CSS, vendor libraries, assets, and Vercel config into dist/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('🚀 Starting AlyxCut Production Build...');

// Clean existing dist
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 1. Copy index.html
fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(DIST_DIR, 'index.html'));
console.log('✅ Copied index.html');

// 2. Copy vercel.json
if (fs.existsSync(path.join(__dirname, 'vercel.json'))) {
  fs.copyFileSync(path.join(__dirname, 'vercel.json'), path.join(DIST_DIR, 'vercel.json'));
  console.log('✅ Copied vercel.json');
}

// 3. Copy css
if (fs.existsSync(path.join(__dirname, 'css'))) {
  copyDirRecursive(path.join(__dirname, 'css'), path.join(DIST_DIR, 'css'));
  console.log('✅ Copied css/');
}

// 4. Copy js
if (fs.existsSync(path.join(__dirname, 'js'))) {
  copyDirRecursive(path.join(__dirname, 'js'), path.join(DIST_DIR, 'js'));
  console.log('✅ Copied js/');
}

// 5. Copy vendor
if (fs.existsSync(path.join(__dirname, 'vendor'))) {
  copyDirRecursive(path.join(__dirname, 'vendor'), path.join(DIST_DIR, 'vendor'));
  console.log('✅ Copied vendor/');
}

// 6. Copy assets
if (fs.existsSync(path.join(__dirname, 'assets'))) {
  copyDirRecursive(path.join(__dirname, 'assets'), path.join(DIST_DIR, 'assets'));
  console.log('✅ Copied assets/');
}

console.log('\n🎉 Production build complete! All files generated in dist/');

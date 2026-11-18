// Automated Test for Upload Validation & Formatting
import { validateVideoFile, formatBytes, formatDuration } from '../js/upload.js';

console.log('🧪 Running Video Upload & Validation Tests...\n');

let passed = 0;
let failed = 0;

// Test 1: Duration formatting
if (formatDuration(0) === '00:00' && formatDuration(65) === '01:05' && formatDuration(3665) === '1:01:05') {
  console.log('✅ [PASS] formatDuration handles 0s, 65s, and > 1hr correctly.');
  passed++;
} else {
  console.error('❌ [FAIL] formatDuration failed.');
  failed++;
}

// Test 2: Bytes formatting
if (formatBytes(1024) === '1 KB' && formatBytes(1048576 * 50) === '50 MB' && formatBytes(1073741824 * 1.5) === '1.5 GB') {
  console.log('✅ [PASS] formatBytes formats KB, MB, and GB accurately.');
  passed++;
} else {
  console.error('❌ [FAIL] formatBytes failed.');
  failed++;
}

// Test 3: Validation of file extensions
const validFile = { name: 'test_speech.mp4', type: 'video/mp4', size: 10485760 };
const invalidFile = { name: 'document.pdf', type: 'application/pdf', size: 1048576 };
const largeFile = { name: 'huge_4k.mkv', type: 'video/x-matroska', size: 1073741824 * 2 }; // 2GB

const res1 = validateVideoFile(validFile);
const res2 = validateVideoFile(invalidFile);
const res3 = validateVideoFile(largeFile);

if (res1.valid && !res2.valid && res3.valid && res3.warning) {
  console.log('✅ [PASS] validateVideoFile accepts MP4, rejects PDF, and warns on 2GB MKV.');
  passed++;
} else {
  console.error('❌ [FAIL] validateVideoFile failed.');
  failed++;
}

console.log(`\nUpload Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);

// Automated Test for AI Video Analysis & Scoring Engine
import { scoreCandidateClip, generateCandidateClips } from '../js/analysis.js';

console.log('🧪 Running AI Analysis & Smart Clip Scoring Tests...\n');

// Mock transcript chunks representing a 120-second video
const mockChunks = [
  // Segment 1: High engagement opening hook (0 - 25s)
  { id: 1, text: 'क्या आपको पता है यह AI सीक्रेट?', hinglish: 'Kya aapko pata hai yeh AI secret?', start: 0.5, end: 4.8 },
  { id: 2, text: 'आज इस वीडियो में हम देखेंगे कि कैसे सिर्फ 5 मिनट में वायरल रील्स बन सकती हैं।', hinglish: 'Aaj is video mein hum dekhenge ki kaise sirf 5 minute mein viral reels ban sakti hain.', start: 5.2, end: 12.0 },
  { id: 3, text: 'पहला स्टेप यह है कि आपको सही टूल चुनना होगा।', hinglish: 'Pehla step yeh hai ki aapko sahi tool chunna hoga.', start: 12.5, end: 19.8 },
  { id: 4, text: 'और यह टूल बिल्कुल फ्री है।', hinglish: 'Aur yeh tool bilkul free hai.', start: 20.2, end: 24.5 },

  // Silence gap (25s - 35s)

  // Segment 2: Deep technical explanation (35s - 65s)
  { id: 5, text: 'अब हम दूसरे स्टेप की बात करेंगे।', hinglish: 'Ab hum doosre step ki baat karenge.', start: 36.0, end: 42.0 },
  { id: 6, text: 'जब आप वीडियो अपलोड करते हैं तो लोकल AI बिना किसी सर्वर के ट्रांसक्रिप्शन करता है।', hinglish: 'Jab aap video upload karte hain to local AI bina kisi server ke transcription karta hai.', start: 42.5, end: 54.0 },
  { id: 7, text: 'इससे आपका डेटा पूरी तरह से सुरक्षित रहता है।', hinglish: 'Isse aapka data poori tarah se surakshit rehta hai.', start: 54.8, end: 63.5 },

  // Segment 3: Conclusion & Outro (75s - 100s)
  { id: 8, text: 'अगर आपको यह वीडियो पसंद आया तो चैनल को सब्सक्राइब जरूर करें।', hinglish: 'Agar aapko yeh video pasand aaya to channel ko subscribe zaroor karein.', start: 76.0, end: 85.0 },
  { id: 9, text: 'मिलते हैं अगली वीडियो में।', hinglish: 'Milte hain agli video mein.', start: 85.5, end: 89.2 },
];

let passed = 0;
let failed = 0;

// Test 1: Scoring candidate with strong hook
const testClip1 = mockChunks.slice(0, 4);
const score1 = scoreCandidateClip(testClip1, 0.5, 24.5, []);

if (score1.score >= 80 && score1.badges.includes('Strong Hook')) {
  console.log(`✅ [PASS] Hook detection test: Score = ${score1.score}/100, Badges: [${score1.badges.join(', ')}]`);
  passed++;
} else {
  console.error(`❌ [FAIL] Hook detection test failed. Score: ${score1.score}`);
  failed++;
}

// Test 2: Generate candidate clips with auto duration
const generated = generateCandidateClips(mockChunks, 100, {
  targetDuration: 30,
  clipCount: 'auto',
});

if (generated.length > 0) {
  console.log(`✅ [PASS] Candidate clips generated: ${generated.length} clips returned.`);
  generated.forEach((c, idx) => {
    console.log(`   Clip ${idx + 1}: "${c.title}" [${c.startTime}s - ${c.endTime}s, dur: ${c.duration}s, score: ${c.score}]`);
  });
  passed++;
} else {
  console.error(`❌ [FAIL] No clips generated.`);
  failed++;
}

// Test 3: Check that generated clips do not overlap
let hasOverlap = false;
for (let i = 0; i < generated.length - 1; i++) {
  if (generated[i].endTime > generated[i + 1].startTime) {
    hasOverlap = true;
    break;
  }
}

if (!hasOverlap) {
  console.log(`✅ [PASS] Non-overlapping test: all clips have distinct non-colliding timeframes.`);
  passed++;
} else {
  console.error(`❌ [FAIL] Overlapping clips detected.`);
  failed++;
}

console.log(`\nAnalysis Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);

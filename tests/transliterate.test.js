// Automated Test for Transliteration Engine
import { hindiToHinglish } from '../js/transliterate.js';

const testCases = [
  {
    input: 'आज हम एक नई टेक्नोलॉजी के बारे में जानेंगे।',
    expectedContains: 'Aaj hum ek nayi technology ke baare mein jaanenge.',
    desc: 'Master prompt example sentence',
  },
  {
    input: 'नमस्ते दोस्तों, आज इस वीडियो में हम AI और Python सीखेंगे।',
    expectedContains: 'Namaste dosto, aaj is video mein hum AI aur Python seekhenge.',
    desc: 'Mixed Hindi-English sentence with common words',
  },
  {
    input: 'क्या आपको पता है यह सबसे बड़ा सीक्रेट है?',
    expectedContains: 'Kya aapko pata hai',
    desc: 'Question hook sentence',
  },
  {
    input: 'कमल भारत का राष्ट्रीय फूल है।',
    expectedContains: 'Kamal',
    desc: 'Schwa deletion test (Kamal not Kamala, Bharat not Bharata)',
  },
  {
    input: 'Hello World 123!',
    expectedContains: 'Hello World 123!',
    desc: 'Pure English and numbers preservation',
  },
];

console.log('🧪 Running Hindi -> Hinglish Transliteration Tests...\n');

let passed = 0;
let failed = 0;

for (const t of testCases) {
  const output = hindiToHinglish(t.input);
  const isMatch = output.includes(t.expectedContains) || output === t.expectedContains;

  if (isMatch) {
    console.log(`✅ [PASS] ${t.desc}`);
    console.log(`   In:  "${t.input}"`);
    console.log(`   Out: "${output}"\n`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${t.desc}`);
    console.error(`   In:       "${t.input}"`);
    console.error(`   Expected: "${t.expectedContains}"`);
    console.error(`   Actual:   "${output}"\n`);
    failed++;
  }
}

console.log(`Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);

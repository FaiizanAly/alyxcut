// AlyxCut Hindi to Hinglish (Roman Hindi) Transliteration Engine
// Developed for AlyxFai - Clean, fast, zero-dependency phonetic transliterator

// High-frequency Hindi vocabulary to ensure natural, colloquial Hinglish spelling
const COMMON_WORDS_MAP = new Map([
  ['आज', 'aaj'],
  ['कल', 'kal'],
  ['परसों', 'parson'],
  ['हम', 'hum'],
  ['एक', 'ek'],
  ['नई', 'nayi'],
  ['नया', 'naya'],
  ['नए', 'naye'],
  ['टेक्नोलॉजी', 'technology'],
  ['तकनीक', 'takneek'],
  ['के', 'ke'],
  ['बारे', 'baare'],
  ['में', 'mein'],
  ['जानेंगे', 'jaanenge'],
  ['जानें', 'jaane'],
  ['जानते', 'jaante'],
  ['है', 'hai'],
  ['हैं', 'hain'],
  ['था', 'tha'],
  ['थी', 'thi'],
  ['थे', 'the'],
  ['नहीं', 'nahi'],
  ['हाँ', 'haan'],
  ['ना', 'na'],
  ['आप', 'aap'],
  ['आपको', 'aapko'],
  ['आपसे', 'aapse'],
  ['आपका', 'aapka'],
  ['आपकी', 'aapki'],
  ['आपके', 'aapke'],
  ['तुम', 'tum'],
  ['तुमको', 'tumko'],
  ['तुम्हारा', 'tumhara'],
  ['मैं', 'main'],
  ['मुझे', 'mujhe'],
  ['मेरा', 'mera'],
  ['मेरी', 'meri'],
  ['मेरे', 'mere'],
  ['क्या', 'kya'],
  ['क्यों', 'kyun'],
  ['क्योंकि', 'kyunki'],
  ['क्योकि', 'kyunki'],
  ['कैसे', 'kaise'],
  ['कब', 'kab'],
  ['कहाँ', 'kahan'],
  ['कहा', 'kaha'],
  ['यह', 'yeh'],
  ['वह', 'woh'],
  ['ये', 'ye'],
  ['वे', 've'],
  ['इस', 'is'],
  ['उस', 'us'],
  ['इन', 'in'],
  ['उन', 'un'],
  ['का', 'ka'],
  ['की', 'ki'],
  ['को', 'ko'],
  ['से', 'se'],
  ['पर', 'par'],
  ['तक', 'tak'],
  ['और', 'aur'],
  ['या', 'ya'],
  ['लेकिन', 'lekin'],
  ['मगर', 'magar'],
  ['तो', 'to'],
  ['भी', 'bhi'],
  ['बहुत', 'bahut'],
  ['ज़्यादा', 'zyada'],
  ['ज्यादा', 'zyada'],
  ['कम', 'kam'],
  ['अच्छा', 'achha'],
  ['अच्छी', 'achhi'],
  ['अच्छे', 'achhe'],
  ['बुरा', 'bura'],
  ['सही', 'sahi'],
  ['गलत', 'galat'],
  ['दोस्तों', 'dosto'],
  ['दोस्तो', 'dosto'],
  ['दोस्त', 'dost'],
  ['भाई', 'bhai'],
  ['नमस्ते', 'namaste'],
  ['स्वागत', 'swagat'],
  ['वीडियो', 'video'],
  ['चैनल', 'channel'],
  ['सब्सक्राइब', 'subscribe'],
  ['लाइक', 'like'],
  ['शेयर', 'share'],
  ['कमेंट', 'comment'],
  ['इंटरनेट', 'internet'],
  ['कंप्यूटर', 'computer'],
  ['मोबाइल', 'mobile'],
  ['स्मार्टफोन', 'smartphone'],
  ['सीक्रेट', 'secret'],
  ['सीक्रेट्स', 'secrets'],
  ['पता', 'pata'],
  ['सबसे', 'sabse'],
  ['बड़ा', 'bada'],
  ['बड़ी', 'badi'],
  ['बड़े', 'bade'],
  ['भारत', 'bharat'],
  ['फूल', 'fool'],
  ['राष्ट्रीय', 'rashtriya'],
  ['करेंगे', 'karenge'],
  ['करते', 'karte'],
  ['करना', 'karna'],
  ['करके', 'karke'],
  ['किया', 'kiya'],
  ['होगा', 'hoga'],
  ['होगी', 'hogi'],
  ['होंगे', 'honge'],
  ['होता', 'hota'],
  ['होती', 'hoti'],
  ['होते', 'hote'],
  ['होना', 'hona'],
  ['रहा', 'raha'],
  ['रही', 'rahi'],
  ['रहे', 'rahe'],
  ['गया', 'gaya'],
  ['गई', 'gayi'],
  ['गए', 'gaye'],
  ['बताएंगे', 'bataenge'],
  ['बताऊंगा', 'bataunga'],
  ['बताता', 'batata'],
  ['देखेंगे', 'dekhenge'],
  ['देखो', 'dekho'],
  ['देखिये', 'dekhiye'],
  ['समझेंगे', 'samjhenge'],
  ['सीखेंगे', 'seekhenge'],
  ['बात', 'baat'],
  ['समय', 'samay'],
  ['वक्त', 'waqt'],
  ['लोग', 'log'],
  ['दिन', 'din'],
  ['साल', 'saal'],
  ['कुछ', 'kuch'],
  ['सब', 'sab'],
  ['कोई', 'koi'],
  ['सिर्फ', 'sirf'],
  ['केवल', 'kewal'],
  ['हमेशा', 'hamesha'],
  ['कभी', 'kabhi'],
  ['यहाँ', 'yahan'],
  ['वहाँ', 'wahan'],
  ['अब', 'ab'],
  ['जब', 'jab'],
  ['तब', 'tab'],
]);

// Devanagari Unicode mapping
const VOWELS = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah'
};

const MATRAS = {
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ं': 'n', 'ँ': 'n', 'ः': 'h'
};

const CONSONANTS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f'
};

const VIRAMA = '्';
const NUKTA = '़';

/**
 * Transliterates a single Devanagari word into Roman Hinglish.
 */
function transliterateWord(word) {
  if (!word) return '';

  // Clean trailing punctuation
  const cleanWord = word.replace(/[।.,!?]/g, '').trim();
  const lowerMatch = COMMON_WORDS_MAP.get(cleanWord);
  if (lowerMatch) {
    return word.replace(cleanWord, lowerMatch);
  }

  // If already Latin or numbers, return as is
  if (!/[\u0900-\u097F]/.test(word)) {
    return word;
  }

  let result = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const char = word[i];
    const nextChar = i + 1 < len ? word[i + 1] : null;

    // Check composite nukta characters (e.g. ड + ़ = ड़)
    if (nextChar === NUKTA) {
      if (char === 'ड') { result += 'r'; i++; continue; }
      if (char === 'ढ') { result += 'rh'; i++; continue; }
      if (char === 'ज') { result += 'z'; i++; continue; }
      if (char === 'फ') { result += 'f'; i++; continue; }
      if (char === 'क') { result += 'q'; i++; continue; }
      if (char === 'ख') { result += 'kh'; i++; continue; }
      if (char === 'ग') { result += 'gh'; i++; continue; }
    }

    // Skip stray nukta
    if (char === NUKTA) {
      continue;
    }

    // Punctuation
    if (char === '।') {
      result += '.';
      continue;
    }

    // Direct vowels (independent)
    if (VOWELS[char]) {
      result += VOWELS[char];
      continue;
    }

    // Matras (dependent vowel signs)
    if (MATRAS[char]) {
      result += MATRAS[char];
      continue;
    }

    // Virama (halant) - suppresses the inherent 'a'
    if (char === VIRAMA) {
      continue;
    }

    // Consonants
    if (CONSONANTS[char]) {
      const romConsonant = CONSONANTS[char];
      result += romConsonant;

      // Check whether to attach inherent 'a'
      const isNextVirama = nextChar === VIRAMA;
      const isNextMatra = nextChar && Boolean(MATRAS[nextChar]);
      const isNextVowel = nextChar && Boolean(VOWELS[nextChar]);
      const isNextNukta = nextChar === NUKTA;
      const isEndOrSpace = !nextChar || /[\s.,!?।]/.test(nextChar);

      if (!isNextVirama && !isNextMatra && !isNextVowel && !isNextNukta) {
        // Schwa deletion: Hindi drops final 'a' in words
        if (!isEndOrSpace) {
          result += 'a';
        }
      }
      continue;
    }

    // Any other character (e.g. digits, symbols, latin)
    result += char;
  }

  return result;
}

/**
 * Transliterates full Hindi text to natural Hinglish.
 * Preserves English words and capitalizes sentence beginnings.
 * @param {string} text - Input text (Devanagari or mixed)
 * @returns {string} - Transliterated Hinglish text
 */
export function hindiToHinglish(text) {
  if (!text || typeof text !== 'string') return '';

  // Replace Hindi full-stop danda '।' with '.'
  const sanitized = text.replace(/।/g, '. ');

  // Split into tokens preserving whitespace and punctuation
  const tokens = sanitized.split(/(\s+|[.,!?;:()]+)/);

  const transliteratedTokens = tokens.map((token) => {
    if (!token || /^\s+$/.test(token) || /^[.,!?;:()]+$/.test(token)) {
      return token;
    }
    return transliterateWord(token);
  });

  let result = transliteratedTokens.join('');

  // Clean double spaces
  result = result.replace(/\s+/g, ' ').trim();

  // Capitalize sentence beginnings
  result = result.replace(/(^\w|[.!?]\s+\w)/g, (c) => c.toUpperCase());

  return result;
}

export default {
  hindiToHinglish,
};

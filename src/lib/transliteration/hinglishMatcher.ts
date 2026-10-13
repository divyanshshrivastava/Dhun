// Handles the absolute chaos of Indian song spellings in the Latin alphabet
// (e.g. "Kal Ho Naa Ho" vs "Kal Ho Na Ho" vs "khnh" vs "kalhonaaho")

export function cleanIndianString(s: string): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // zap diacritics
    .replace(/[^a-z0-9\s]/g, ' ')   // strip weird punctuation like dashes, quotes
    .replace(/\s+/g, ' ')
    .trim();
}

// Collapses common vowel/consonant elongations typical of Hinglish transliteration
export function phoneticHinglish(inputStr: string): string {
  let tmp = cleanIndianString(inputStr);
  if (!tmp) return '';

  // Common Hindi/Urdu vowel stretches
  tmp = tmp.replace(/aa+/g, 'a');
  tmp = tmp.replace(/ee+/g, 'i');
  tmp = tmp.replace(/oo+/g, 'u');
  tmp = tmp.replace(/ii+/g, 'i');
  tmp = tmp.replace(/uu+/g, 'u');

  // Phonetic consonant unifications
  tmp = tmp.replace(/sh/g, 's');
  tmp = tmp.replace(/kh/g, 'k');
  tmp = tmp.replace(/gh/g, 'g');
  tmp = tmp.replace(/chh/g, 'c');
  tmp = tmp.replace(/ch/g, 'c');
  tmp = tmp.replace(/th/g, 't');
  tmp = tmp.replace(/dh/g, 'd');
  tmp = tmp.replace(/bh/g, 'b');
  tmp = tmp.replace(/ph/g, 'f');
  tmp = tmp.replace(/w/g, 'v');
  tmp = tmp.replace(/z/g, 'j');

  // Collapse double letters like "nn" in "channa" -> "chana"
  tmp = tmp.replace(/([a-z])\1+/g, '$1');

  return tmp.replace(/\s+/g, ' ').trim();
}

// Generate acronym like "khnh" from "kal ho naa ho"
export function extractInitialsAcronym(str: string): string {
  const words = cleanIndianString(str).split(' ').filter(Boolean);
  if (words.length <= 1) return '';
  return words.map(w => w[0]).join('');
}

// Simple Levenshtein distance for typo forgiveness
export function quickLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate a match score between 0 and 1
export function calculateHinglishScore(query: string, target: string): number {
  const qClean = cleanIndianString(query);
  const tClean = cleanIndianString(target);

  if (!qClean || !tClean) return 0;
  if (qClean === tClean) return 1.0;

  // Acronym match (e.g. user typed "khnh" and target is "kal ho naa ho")
  const acronym = extractInitialsAcronym(target);
  if (acronym && qClean === acronym) return 0.95;

  // Prefix match on clean string
  if (tClean.startsWith(qClean)) return 0.9;

  // Substring match
  if (tClean.includes(qClean)) return 0.8;

  // Phonetic matching
  const qPhonetic = phoneticHinglish(query);
  const tPhonetic = phoneticHinglish(target);

  if (qPhonetic === tPhonetic) return 0.92;
  if (tPhonetic.startsWith(qPhonetic)) return 0.85;
  if (tPhonetic.includes(qPhonetic)) return 0.75;

  // Word-level prefix match (e.g. "mereya" matches "channa mereya")
  const targetWords = tClean.split(' ');
  const matchedAnyWordPrefix = targetWords.some(w => w.startsWith(qClean));
  if (matchedAnyWordPrefix) return 0.7;

  // Typo tolerance only if strings are of similar length (avoids wasting CPU on huge length differences)
  if (Math.abs(qPhonetic.length - tPhonetic.length) <= 2) {
    const distance = quickLevenshtein(qPhonetic, tPhonetic);
    const maxLen = Math.max(qPhonetic.length, tPhonetic.length);
    if (maxLen > 3 && distance <= 2) {
      return Math.max(0, 1 - distance / maxLen);
    }
  }

  return 0;
}

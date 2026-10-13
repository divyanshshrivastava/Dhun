import { describe, it, expect } from 'vitest';
import {
  cleanIndianString,
  phoneticHinglish,
  extractInitialsAcronym,
  calculateHinglishScore,
} from '../../src/lib/transliteration/hinglishMatcher';

describe('hinglishMatcher - Indian phonetic transliteration engine', () => {
  it('cleans diacritics, punctuation and converts to lowercase', () => {
    expect(cleanIndianString('Kal Ho Naa Ho!')).toBe('kal ho naa ho');
    expect(cleanIndianString('Dilbar... (1999 Remake)')).toBe('dilbar 1999 remake');
    expect(cleanIndianString('   Chaiyya    Chaiyya   ')).toBe('chaiyya chaiyya');
  });

  it('normalizes elongated vowels and phonetic spellings', () => {
    // "aa" -> "a"
    expect(phoneticHinglish('naa')).toBe(phoneticHinglish('na'));
    // "ee" -> "i"
    expect(phoneticHinglish('dheere')).toBe(phoneticHinglish('dhire'));
    // "oo" -> "u"
    expect(phoneticHinglish('tumhihooo')).toBe(phoneticHinglish('tumhihu'));
    // "sh" -> "s"
    expect(phoneticHinglish('shershaah')).toBe(phoneticHinglish('sersah'));
    // "ph" -> "f"
    expect(phoneticHinglish('phir')).toBe(phoneticHinglish('fir'));
  });

  it('extracts acronyms accurately from Bollywood titles', () => {
    expect(extractInitialsAcronym('Kal Ho Naa Ho')).toBe('khnh');
    expect(extractInitialsAcronym('Yeh Jawaani Hai Deewani')).toBe('yjhd');
    expect(extractInitialsAcronym('Dilwale Dulhania Le Jayenge')).toBe('ddlj');
    expect(extractInitialsAcronym('Single')).toBe('');
  });

  it('scores high on identical strings and abbreviations', () => {
    const perfectScore = calculateHinglishScore('kal ho na ho', 'Kal Ho Na Ho');
    expect(perfectScore).toBe(1.0);

    // Acronym lookup like "khnh" for "Kal Ho Naa Ho"
    const acronymScore = calculateHinglishScore('khnh', 'Kal Ho Naa Ho');
    expect(acronymScore).toBeGreaterThanOrEqual(0.9);
  });

  it('tolerates vowel elongation mismatches in Hinglish', () => {
    // "chana mereya" vs "Channa Mereya"
    const score1 = calculateHinglishScore('chana mereya', 'Channa Mereya');
    expect(score1).toBeGreaterThanOrEqual(0.8);

    // "tum hi ho" vs "Tumhiho"
    const score2 = calculateHinglishScore('tumhiho', 'Tum Hi Ho');
    expect(score2).toBeGreaterThanOrEqual(0.7);
  });

  it('returns zero for completely unrelated strings', () => {
    const unrelated = calculateHinglishScore('kesariya', 'Chaiyya Chaiyya');
    expect(unrelated).toBe(0);
  });
});

import type { CharacterDefinition } from '@/types';

// Basic Latin uppercase A-Z
const UPPERCASE: CharacterDefinition[] = Array.from({ length: 26 }, (_, i) => ({
  unicode: 0x0041 + i,
  name: String.fromCharCode(0x0041 + i),
  character: String.fromCharCode(0x0041 + i),
  category: 'uppercase' as const,
  required: true,
}));

// Basic Latin lowercase a-z
const LOWERCASE: CharacterDefinition[] = Array.from({ length: 26 }, (_, i) => ({
  unicode: 0x0061 + i,
  name: String.fromCharCode(0x0061 + i),
  character: String.fromCharCode(0x0061 + i),
  category: 'lowercase' as const,
  required: true,
}));

// Numbers 0-9
const NUMBERS: CharacterDefinition[] = Array.from({ length: 10 }, (_, i) => ({
  unicode: 0x0030 + i,
  name: `digit${i}`,
  character: String.fromCharCode(0x0030 + i),
  category: 'number' as const,
  required: true,
}));

// Basic punctuation
const PUNCTUATION: CharacterDefinition[] = [
  { unicode: 0x0020, name: 'space', character: ' ', category: 'punctuation', required: true },
  { unicode: 0x0021, name: 'exclam', character: '!', category: 'punctuation', required: true },
  { unicode: 0x0022, name: 'quotedbl', character: '"', category: 'punctuation', required: true },
  { unicode: 0x0023, name: 'numbersign', character: '#', category: 'punctuation', required: true },
  { unicode: 0x0024, name: 'dollar', character: '$', category: 'symbol', required: true },
  { unicode: 0x0025, name: 'percent', character: '%', category: 'punctuation', required: true },
  { unicode: 0x0026, name: 'ampersand', character: '&', category: 'punctuation', required: true },
  { unicode: 0x0027, name: 'quotesingle', character: "'", category: 'punctuation', required: true },
  { unicode: 0x0028, name: 'parenleft', character: '(', category: 'punctuation', required: true },
  { unicode: 0x0029, name: 'parenright', character: ')', category: 'punctuation', required: true },
  { unicode: 0x002A, name: 'asterisk', character: '*', category: 'punctuation', required: true },
  { unicode: 0x002B, name: 'plus', character: '+', category: 'punctuation', required: true },
  { unicode: 0x002C, name: 'comma', character: ',', category: 'punctuation', required: true },
  { unicode: 0x002D, name: 'hyphen', character: '-', category: 'punctuation', required: true },
  { unicode: 0x002E, name: 'period', character: '.', category: 'punctuation', required: true },
  { unicode: 0x002F, name: 'slash', character: '/', category: 'punctuation', required: true },
  { unicode: 0x003A, name: 'colon', character: ':', category: 'punctuation', required: true },
  { unicode: 0x003B, name: 'semicolon', character: ';', category: 'punctuation', required: true },
  { unicode: 0x003C, name: 'less', character: '<', category: 'punctuation', required: true },
  { unicode: 0x003D, name: 'equal', character: '=', category: 'punctuation', required: true },
  { unicode: 0x003E, name: 'greater', character: '>', category: 'punctuation', required: true },
  { unicode: 0x003F, name: 'question', character: '?', category: 'punctuation', required: true },
  { unicode: 0x0040, name: 'at', character: '@', category: 'symbol', required: true },
  { unicode: 0x005B, name: 'bracketleft', character: '[', category: 'punctuation', required: true },
  { unicode: 0x005C, name: 'backslash', character: '\\', category: 'punctuation', required: true },
  { unicode: 0x005D, name: 'bracketright', character: ']', category: 'punctuation', required: true },
  { unicode: 0x005E, name: 'asciicircum', character: '^', category: 'punctuation', required: false },
  { unicode: 0x005F, name: 'underscore', character: '_', category: 'punctuation', required: true },
  { unicode: 0x0060, name: 'grave', character: '`', category: 'punctuation', required: false },
  { unicode: 0x007B, name: 'braceleft', character: '{', category: 'punctuation', required: true },
  { unicode: 0x007C, name: 'bar', character: '|', category: 'punctuation', required: true },
  { unicode: 0x007D, name: 'braceright', character: '}', category: 'punctuation', required: true },
  { unicode: 0x007E, name: 'asciitilde', character: '~', category: 'punctuation', required: false },
];

// Extended Latin - Accented characters
const ACCENTED: CharacterDefinition[] = [
  // Uppercase accented
  { unicode: 0x00C0, name: 'Agrave', character: 'À', category: 'accented', required: false },
  { unicode: 0x00C1, name: 'Aacute', character: 'Á', category: 'accented', required: false },
  { unicode: 0x00C2, name: 'Acircumflex', character: 'Â', category: 'accented', required: false },
  { unicode: 0x00C3, name: 'Atilde', character: 'Ã', category: 'accented', required: false },
  { unicode: 0x00C4, name: 'Adieresis', character: 'Ä', category: 'accented', required: false },
  { unicode: 0x00C5, name: 'Aring', character: 'Å', category: 'accented', required: false },
  { unicode: 0x00C6, name: 'AE', character: 'Æ', category: 'accented', required: false },
  { unicode: 0x00C7, name: 'Ccedilla', character: 'Ç', category: 'accented', required: false },
  { unicode: 0x00C8, name: 'Egrave', character: 'È', category: 'accented', required: false },
  { unicode: 0x00C9, name: 'Eacute', character: 'É', category: 'accented', required: false },
  { unicode: 0x00CA, name: 'Ecircumflex', character: 'Ê', category: 'accented', required: false },
  { unicode: 0x00CB, name: 'Edieresis', character: 'Ë', category: 'accented', required: false },
  { unicode: 0x00CC, name: 'Igrave', character: 'Ì', category: 'accented', required: false },
  { unicode: 0x00CD, name: 'Iacute', character: 'Í', category: 'accented', required: false },
  { unicode: 0x00CE, name: 'Icircumflex', character: 'Î', category: 'accented', required: false },
  { unicode: 0x00CF, name: 'Idieresis', character: 'Ï', category: 'accented', required: false },
  { unicode: 0x00D0, name: 'Eth', character: 'Ð', category: 'accented', required: false },
  { unicode: 0x00D1, name: 'Ntilde', character: 'Ñ', category: 'accented', required: false },
  { unicode: 0x00D2, name: 'Ograve', character: 'Ò', category: 'accented', required: false },
  { unicode: 0x00D3, name: 'Oacute', character: 'Ó', category: 'accented', required: false },
  { unicode: 0x00D4, name: 'Ocircumflex', character: 'Ô', category: 'accented', required: false },
  { unicode: 0x00D5, name: 'Otilde', character: 'Õ', category: 'accented', required: false },
  { unicode: 0x00D6, name: 'Odieresis', character: 'Ö', category: 'accented', required: false },
  { unicode: 0x00D8, name: 'Oslash', character: 'Ø', category: 'accented', required: false },
  { unicode: 0x00D9, name: 'Ugrave', character: 'Ù', category: 'accented', required: false },
  { unicode: 0x00DA, name: 'Uacute', character: 'Ú', category: 'accented', required: false },
  { unicode: 0x00DB, name: 'Ucircumflex', character: 'Û', category: 'accented', required: false },
  { unicode: 0x00DC, name: 'Udieresis', character: 'Ü', category: 'accented', required: false },
  { unicode: 0x00DD, name: 'Yacute', character: 'Ý', category: 'accented', required: false },
  { unicode: 0x00DE, name: 'Thorn', character: 'Þ', category: 'accented', required: false },
  { unicode: 0x00DF, name: 'germandbls', character: 'ß', category: 'accented', required: false },
  // Lowercase accented
  { unicode: 0x00E0, name: 'agrave', character: 'à', category: 'accented', required: false },
  { unicode: 0x00E1, name: 'aacute', character: 'á', category: 'accented', required: false },
  { unicode: 0x00E2, name: 'acircumflex', character: 'â', category: 'accented', required: false },
  { unicode: 0x00E3, name: 'atilde', character: 'ã', category: 'accented', required: false },
  { unicode: 0x00E4, name: 'adieresis', character: 'ä', category: 'accented', required: false },
  { unicode: 0x00E5, name: 'aring', character: 'å', category: 'accented', required: false },
  { unicode: 0x00E6, name: 'ae', character: 'æ', category: 'accented', required: false },
  { unicode: 0x00E7, name: 'ccedilla', character: 'ç', category: 'accented', required: false },
  { unicode: 0x00E8, name: 'egrave', character: 'è', category: 'accented', required: false },
  { unicode: 0x00E9, name: 'eacute', character: 'é', category: 'accented', required: false },
  { unicode: 0x00EA, name: 'ecircumflex', character: 'ê', category: 'accented', required: false },
  { unicode: 0x00EB, name: 'edieresis', character: 'ë', category: 'accented', required: false },
  { unicode: 0x00EC, name: 'igrave', character: 'ì', category: 'accented', required: false },
  { unicode: 0x00ED, name: 'iacute', character: 'í', category: 'accented', required: false },
  { unicode: 0x00EE, name: 'icircumflex', character: 'î', category: 'accented', required: false },
  { unicode: 0x00EF, name: 'idieresis', character: 'ï', category: 'accented', required: false },
  { unicode: 0x00F0, name: 'eth', character: 'ð', category: 'accented', required: false },
  { unicode: 0x00F1, name: 'ntilde', character: 'ñ', category: 'accented', required: false },
  { unicode: 0x00F2, name: 'ograve', character: 'ò', category: 'accented', required: false },
  { unicode: 0x00F3, name: 'oacute', character: 'ó', category: 'accented', required: false },
  { unicode: 0x00F4, name: 'ocircumflex', character: 'ô', category: 'accented', required: false },
  { unicode: 0x00F5, name: 'otilde', character: 'õ', category: 'accented', required: false },
  { unicode: 0x00F6, name: 'odieresis', character: 'ö', category: 'accented', required: false },
  { unicode: 0x00F8, name: 'oslash', character: 'ø', category: 'accented', required: false },
  { unicode: 0x00F9, name: 'ugrave', character: 'ù', category: 'accented', required: false },
  { unicode: 0x00FA, name: 'uacute', character: 'ú', category: 'accented', required: false },
  { unicode: 0x00FB, name: 'ucircumflex', character: 'û', category: 'accented', required: false },
  { unicode: 0x00FC, name: 'udieresis', character: 'ü', category: 'accented', required: false },
  { unicode: 0x00FD, name: 'yacute', character: 'ý', category: 'accented', required: false },
  { unicode: 0x00FE, name: 'thorn', character: 'þ', category: 'accented', required: false },
  { unicode: 0x00FF, name: 'ydieresis', character: 'ÿ', category: 'accented', required: false },
];

// Additional symbols
const SYMBOLS: CharacterDefinition[] = [
  { unicode: 0x00A1, name: 'exclamdown', character: '¡', category: 'symbol', required: false },
  { unicode: 0x00A2, name: 'cent', character: '¢', category: 'symbol', required: false },
  { unicode: 0x00A3, name: 'sterling', character: '£', category: 'symbol', required: false },
  { unicode: 0x00A5, name: 'yen', character: '¥', category: 'symbol', required: false },
  { unicode: 0x00A7, name: 'section', character: '§', category: 'symbol', required: false },
  { unicode: 0x00A9, name: 'copyright', character: '©', category: 'symbol', required: false },
  { unicode: 0x00AB, name: 'guillemotleft', character: '«', category: 'symbol', required: false },
  { unicode: 0x00AE, name: 'registered', character: '®', category: 'symbol', required: false },
  { unicode: 0x00B0, name: 'degree', character: '°', category: 'symbol', required: false },
  { unicode: 0x00B1, name: 'plusminus', character: '±', category: 'symbol', required: false },
  { unicode: 0x00B6, name: 'paragraph', character: '¶', category: 'symbol', required: false },
  { unicode: 0x00BB, name: 'guillemotright', character: '»', category: 'symbol', required: false },
  { unicode: 0x00BF, name: 'questiondown', character: '¿', category: 'symbol', required: false },
  { unicode: 0x00D7, name: 'multiply', character: '×', category: 'symbol', required: false },
  { unicode: 0x00F7, name: 'divide', character: '÷', category: 'symbol', required: false },
  { unicode: 0x20AC, name: 'Euro', character: '€', category: 'symbol', required: false },
];

// All characters combined
export const ALL_CHARACTERS: CharacterDefinition[] = [
  ...UPPERCASE,
  ...LOWERCASE,
  ...NUMBERS,
  ...PUNCTUATION,
  ...ACCENTED,
  ...SYMBOLS,
];

// Required characters only
export const REQUIRED_CHARACTERS = ALL_CHARACTERS.filter(c => c.required);

// Get characters by category
export function getCharactersByCategory(category: CharacterDefinition['category']): CharacterDefinition[] {
  return ALL_CHARACTERS.filter(c => c.category === category);
}

// Common ligatures
export const COMMON_LIGATURES = [
  { sequence: 'fi', name: 'fi' },
  { sequence: 'fl', name: 'fl' },
  { sequence: 'ff', name: 'ff' },
  { sequence: 'ffi', name: 'ffi' },
  { sequence: 'ffl', name: 'ffl' },
];

// Default font metrics
export const DEFAULT_METRICS = {
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  capHeight: 700,
  xHeight: 500,
};

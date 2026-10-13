// Supported Indian languages and regional traditions

export const SUPPORTED_LANGUAGES = [
  { id: 'hindi', label: 'Hindi / Bollywood', isDefault: true },
  { id: 'punjabi', label: 'Punjabi', isDefault: false },
  { id: 'tamil', label: 'Tamil', isDefault: false },
  { id: 'telugu', label: 'Telugu', isDefault: false },
  { id: 'malayalam', label: 'Malayalam', isDefault: false },
  { id: 'kannada', label: 'Kannada', isDefault: false },
  { id: 'bengali', label: 'Bengali', isDefault: false },
  { id: 'marathi', label: 'Marathi', isDefault: false },
  { id: 'gujarati', label: 'Gujarati', isDefault: false },
  { id: 'indie', label: 'Indie / Indipop', isDefault: false },
  { id: 'ghazal', label: 'Ghazals & Sufi', isDefault: false },
] as const;

export type SupportedLanguageId = typeof SUPPORTED_LANGUAGES[number]['id'];

// Language configuration for Levcon.ai AI News
// Internal codes use ISO 639-1 (for LLM/DB compatibility)
// Display codes use commonly recognized abbreviations for DACH/European audience

export type NewsLanguage = {
  code: string;        // Internal code (ISO 639-1): de, en, zh, ja, fr, ar, es, it, pt, ru
  label: string;       // Display label: "DE - Deutsch", "CN - Chinese", "JP - Japanese"
  shortLabel: string;  // Short label for tags: DE, CN, JP, FR, AR, ES
  nativeName: string;  // Native name: Deutsch, English, 中文, 日本語
  rtl: boolean;        // Right-to-left rendering
};

export const NEWS_LANGUAGES: NewsLanguage[] = [
  { code: 'de', label: 'DE - Deutsch',      shortLabel: 'DE', nativeName: 'Deutsch',     rtl: false },
  { code: 'en', label: 'EN - English',      shortLabel: 'EN', nativeName: 'English',     rtl: false },
];

// Quick lookup maps
export const LANG_CODE_TO_SHORT: Record<string, string> = Object.fromEntries(
  NEWS_LANGUAGES.map(l => [l.code, l.shortLabel])
);

export const LANG_CODE_TO_NATIVE: Record<string, string> = Object.fromEntries(
  NEWS_LANGUAGES.map(l => [l.code, l.nativeName])
);

export const LANG_CODE_TO_RTL: Record<string, boolean> = Object.fromEntries(
  NEWS_LANGUAGES.map(l => [l.code, l.rtl])
);

// All valid language codes (for API validation)
export const VALID_LANG_CODES = NEWS_LANGUAGES.map(l => l.code);

// Default selected languages for new subscribers
export const DEFAULT_NEWS_LANGS = ['de', 'en'];

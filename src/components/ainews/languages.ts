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
  { code: 'zh', label: 'CN - Chinese',      shortLabel: 'CN', nativeName: '中文',         rtl: false },
  { code: 'ja', label: 'JP - Japanese',     shortLabel: 'JP', nativeName: '日本語',       rtl: false },
  { code: 'fr', label: 'FR - Français',     shortLabel: 'FR', nativeName: 'Français',    rtl: false },
  { code: 'es', label: 'ES - Español',      shortLabel: 'ES', nativeName: 'Español',     rtl: false },
  { code: 'it', label: 'IT - Italiano',     shortLabel: 'IT', nativeName: 'Italiano',    rtl: false },
  { code: 'pt', label: 'PT - Português',    shortLabel: 'PT', nativeName: 'Português',   rtl: false },
  { code: 'ru', label: 'RU - Русский',      shortLabel: 'RU', nativeName: 'Русский',     rtl: false },
  { code: 'ar', label: 'AR - العربية',      shortLabel: 'AR', nativeName: 'العربية',     rtl: true  },
  { code: 'tr', label: 'TR - Türkçe',       shortLabel: 'TR', nativeName: 'Türkçe',      rtl: false },
  { code: 'nl', label: 'NL - Nederlands',   shortLabel: 'NL', nativeName: 'Nederlands',  rtl: false },
  { code: 'pl', label: 'PL - Polski',       shortLabel: 'PL', nativeName: 'Polski',      rtl: false },
  { code: 'ko', label: 'KR - Korean',       shortLabel: 'KR', nativeName: '한국어',       rtl: false },
  { code: 'hi', label: 'IN - Hindi',        shortLabel: 'IN', nativeName: 'हिन्दी',       rtl: false },
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

// ═══════════════════════════════════════════════════════════════
//  VALIDATE LLM OUTPUT (v1 — Post-LLM Quality Gate)
//
//  Node-Typ: Code (n8n)
//  Position: nach "Build Ollama Request (v6)", vor "POST Ingest"
//
//  Zweck:
//   - Validiert das LLM-JSON-Output gegen ein strenges Schema
//   - Wirft keine Errors (destruktiv), sondern DROPPT ungültige Items
//     und sammelt Warnings
//   - Berechnet Bucket-Balance (DE/EN) und entscheidet über Fallback
//   - Stellt sicher, dass nur qualitativ hochwertige Items in die DB kommen
//   - Generiert einen strukturierten Quality-Report für Alert-Emails
//
//  Standards (per QUALITY-GUIDELINES.md):
//   - RFC 3986 (URL-Format)
//   - ISO 8601 (Datumsformat im Report)
//   - JSON:API-konforme Fehlerstruktur
//   - try/catch mit spezifischer Fehlerbehandlung
//   - Pure JavaScript (n8n Code-Node v2 — kein TypeScript)
// ═══════════════════════════════════════════════════════════════

// ── KONFIGURATION ──────────────────────────────────────────────
const MIN_ITEMS_PER_BUCKET = 7;        // 10 ideal, 7 tolerierbar (ruhige Tage)
const MIN_SUMMARY_LENGTH   = 80;
const MIN_DESC_LENGTH      = 50;
const MAX_DESC_LENGTH      = 600;      // lange Descriptions toleriert (nur Warning)
const MIN_HEADLINE_LENGTH  = 20;
const MAX_HEADLINE_LENGTH  = 300;

const VALID_CATEGORIES = new Set([
  'research', 'business', 'regulation', 'tools', 'society'
]);

const SENTENCE_ENDINGS = /[.!?…]\s*$/;

// Marker-Texte die LLM manchmal bei fehlendem Content schreibt
const FALLBACK_MARKERS = [
  /^keine zusammenfassung verfügbar\.?$/i,
  /^no summary available\.?$/i,
  /^n\/a$/i,
  /^placeholder/i,
  /^todo/i,
  /^tbd$/i,
];

// Non-Latin Unicode ranges (CJK, Cyrillic, Arabic, Hebrew, Thai, etc.)
// Latin Extended (ÄÖÜßéà) ist erlaubt.
// Quelle: Unicode Standard, Basic Multilingual Plane
const NON_LATIN_RE = /[\u0400-\u04FF\u0500-\u052F\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u1380-\u139F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u171F\u1720-\u173F\u1740-\u175F\u1760-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1A20-\u1AAF\u1B00-\u1B7F\u1B80-\u1BBF\u1BC0-\u1BFF\u1C00-\u1C4F\u1C50-\u1C7F\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]/;

// ═══════════════════════════════════════════════════════════════
//  VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Validate URL format per RFC 3986 (basic structural check).
 * Must have http: or https: protocol.
 * @param {string} url
 * @returns {boolean}
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Check if text ends with a sentence-ending punctuation mark.
 * Handles . ! ? … (Ellipsis) — multi-lingual safe.
 * @param {string} text
 * @returns {boolean}
 */
function endsWithSentence(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return SENTENCE_ENDINGS.test(trimmed);
}

/**
 * Check if text matches any known fallback marker (LLM-placeholder).
 * @param {string} text
 * @returns {boolean}
 */
function isFallbackMarker(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return FALLBACK_MARKERS.some(function (re) { return re.test(trimmed); });
}

/**
 * Detect non-Latin script characters (Qwen sometimes hallucinates CJK/Cyrillic).
 * @param {string} text
 * @returns {boolean}
 */
function hasNonLatinChars(text) {
  if (!text || typeof text !== 'string') return false;
  return NON_LATIN_RE.test(text);
}

/**
 * Validate a single LLM item against schema.
 * @param {object} item - LLM-generated item
 * @param {number} index - 0-based index for error messages
 * @returns {{valid: boolean, warnings: string[]}}
 */
function validateItem(item, index) {
  const warnings = [];
  let valid = true;

  if (!item || typeof item !== 'object') {
    return { valid: false, warnings: ['Item ' + (index + 1) + ': not an object'] };
  }

  // ── headline (required) ────────────────────────────────────
  const headline = (item.headline || '').toString().trim();
  if (!headline) {
    warnings.push('Item ' + (index + 1) + ': headline empty');
    valid = false;
  } else if (headline.length < MIN_HEADLINE_LENGTH) {
    warnings.push('Item ' + (index + 1) + ': headline too short (' + headline.length + ' chars, min ' + MIN_HEADLINE_LENGTH + ')');
    valid = false;
  } else if (headline.length > MAX_HEADLINE_LENGTH) {
    warnings.push('Item ' + (index + 1) + ': headline too long (' + headline.length + ' chars, max ' + MAX_HEADLINE_LENGTH + ')');
    valid = false;
  }
  if (hasNonLatinChars(headline)) {
    warnings.push('Item ' + (index + 1) + ': headline contains non-Latin characters');
    valid = false;
  }

  // ── descriptionDe (required) ───────────────────────────────
  const descDe = (item.descriptionDe || '').toString().trim();
  if (!descDe) {
    warnings.push('Item ' + (index + 1) + ': descriptionDe empty');
    valid = false;
  } else if (isFallbackMarker(descDe)) {
    warnings.push('Item ' + (index + 1) + ': descriptionDe is fallback marker');
    valid = false;
  } else if (descDe.length < MIN_DESC_LENGTH) {
    warnings.push('Item ' + (index + 1) + ': descriptionDe too short (' + descDe.length + ' chars, min ' + MIN_DESC_LENGTH + ')');
    valid = false;
  } else if (descDe.length > MAX_DESC_LENGTH) {
    warnings.push('Item ' + (index + 1) + ': descriptionDe too long (' + descDe.length + ' chars, max ' + MAX_DESC_LENGTH + ')');
    // Long descriptions tolerated (render truncates), valid stays true
  } else if (!endsWithSentence(descDe)) {
    warnings.push('Item ' + (index + 1) + ': descriptionDe doesn\'t end with sentence punctuation (possible truncation)');
    // Truncated description = strong LLM token-limit signal
    // Mark as warning but keep valid (don't lose the whole item)
  }
  if (hasNonLatinChars(descDe)) {
    warnings.push('Item ' + (index + 1) + ': descriptionDe contains non-Latin characters');
    valid = false;
  }

  // ── descriptionEn (optional, but if present must be valid) ─
  if (item.descriptionEn) {
    const descEn = item.descriptionEn.toString().trim();
    if (isFallbackMarker(descEn)) {
      warnings.push('Item ' + (index + 1) + ': descriptionEn is fallback marker');
      item.descriptionEn = null;  // Clear invalid, frontend falls back to DE
    } else if (descEn.length > 0 && descEn.length < MIN_DESC_LENGTH) {
      warnings.push('Item ' + (index + 1) + ': descriptionEn too short (' + descEn.length + ' chars)');
      item.descriptionEn = null;
    } else if (hasNonLatinChars(descEn)) {
      warnings.push('Item ' + (index + 1) + ': descriptionEn contains non-Latin characters');
      item.descriptionEn = null;
    }
  }

  // ── sourceUrl (RFC 3986) ───────────────────────────────────
  if (!isValidUrl(item.sourceUrl || '')) {
    warnings.push('Item ' + (index + 1) + ': sourceUrl invalid (' + (item.sourceUrl || '').substring(0, 50) + ')');
    valid = false;
  }

  // ── source (required) ──────────────────────────────────────
  if (!item.source || item.source.toString().trim().length < 2) {
    warnings.push('Item ' + (index + 1) + ': source missing or too short');
    valid = false;
  }

  // ── languageOrig (required, must be de|en) ─────────────────
  const lang = (item.languageOrig || '').toString().toLowerCase();
  if (!['de', 'en'].includes(lang)) {
    warnings.push('Item ' + (index + 1) + ': languageOrig invalid ("' + lang + '", expected de|en)');
    valid = false;
  }

  // ── category (optional, but if present must be valid) ──────
  if (item.category) {
    const cat = item.category.toString().toLowerCase();
    if (!VALID_CATEGORIES.has(cat)) {
      warnings.push('Item ' + (index + 1) + ': category invalid ("' + cat + '")');
      item.category = null;
    } else {
      item.category = cat;  // Normalize to lowercase
    }
  }

  return { valid: valid, warnings: warnings };
}

/**
 * Validate summary text.
 * @param {string} summary
 * @param {string} lang - 'de' or 'en' (for error message)
 * @returns {{ok: boolean, warning?: string}}
 */
function validateSummary(summary, lang) {
  if (!summary || typeof summary !== 'string') {
    return { ok: false, warning: 'summary' + lang.toUpperCase() + ' empty' };
  }
  const trimmed = summary.trim();
  if (trimmed.length < MIN_SUMMARY_LENGTH) {
    return { ok: false, warning: 'summary' + lang.toUpperCase() + ' too short (' + trimmed.length + ' chars, min ' + MIN_SUMMARY_LENGTH + ')' };
  }
  if (!endsWithSentence(trimmed)) {
    return { ok: false, warning: 'summary' + lang.toUpperCase() + ' doesn\'t end with sentence punctuation (possible truncation)' };
  }
  if (hasNonLatinChars(trimmed)) {
    return { ok: false, warning: 'summary' + lang.toUpperCase() + ' contains non-Latin characters' };
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════

const input = $input.all();
if (!input || input.length === 0 || !input[0].json) {
  throw new Error('Validate LLM Output: No input from Build Ollama node');
}

const llmData = input[0].json;

if (!llmData.items || !Array.isArray(llmData.items)) {
  throw new Error('Validate LLM Output: items array missing in LLM output');
}

console.log('[Validate v1] Input: ' + llmData.items.length + ' items, summaryDe=' + (llmData.summaryDe ? '✓' : '✗') + ', summaryEn=' + (llmData.summaryEn ? '✓' : '✗'));

// ── 1. Validate each item ─────────────────────────────────────
const allWarnings = [];
const allErrors = [];

const validatedItems = [];
let deValid = 0;
let enValid = 0;
let deDropped = 0;
let enDropped = 0;

llmData.items.forEach(function (item, idx) {
  const result = validateItem(item, idx);

  if (result.valid) {
    validatedItems.push(item);
    const lang = (item.languageOrig || 'en').toLowerCase();
    if (lang === 'de') deValid++;
    else enValid++;
  } else {
    const lang = (item.languageOrig || 'en').toLowerCase();
    if (lang === 'de') deDropped++;
    else enDropped++;
    allWarnings.push.apply(allWarnings, result.warnings);
    console.log('[Validate v1] ❌ DROPPED Item ' + (idx + 1) + ': ' + result.warnings.join('; '));
  }
});

// ── 2. Validate summaries ─────────────────────────────────────
const deSummaryCheck = validateSummary(llmData.summaryDe, 'de');
const enSummaryCheck = validateSummary(llmData.summaryEn, 'en');

if (!deSummaryCheck.ok) {
  allWarnings.push(deSummaryCheck.warning);
  console.log('[Validate v1] ⚠️ summaryDe issue: ' + deSummaryCheck.warning);
}
if (!enSummaryCheck.ok) {
  allWarnings.push(enSummaryCheck.warning);
  console.log('[Validate v1] ⚠️ summaryEn issue: ' + enSummaryCheck.warning);
}

// ── 3. Determine overall status + fallback recommendation ─────
let overallStatus = 'success';
let fallbackRecommendation = 'none';

// Critical: both buckets critically low → recommend previous_day fallback
if (deValid < 3 && enValid < 3) {
  overallStatus = 'error';
  fallbackRecommendation = 'previous_day';
  allErrors.push('Critical: both buckets critically low (DE=' + deValid + ', EN=' + enValid + ')');
} else if (deValid < MIN_ITEMS_PER_BUCKET || enValid < MIN_ITEMS_PER_BUCKET) {
  // One bucket below threshold → partial
  overallStatus = 'partial';
  if (deValid === 0 || enValid === 0) {
    fallbackRecommendation = 'previous_day';
  }
  if (deValid < MIN_ITEMS_PER_BUCKET) {
    allWarnings.push('DE bucket below threshold (' + deValid + '/' + MIN_ITEMS_PER_BUCKET + ')');
  }
  if (enValid < MIN_ITEMS_PER_BUCKET) {
    allWarnings.push('EN bucket below threshold (' + enValid + '/' + MIN_ITEMS_PER_BUCKET + ')');
  }
}

// Summary issues → partial (even if items OK)
if (overallStatus === 'success' && (!deSummaryCheck.ok || !enSummaryCheck.ok)) {
  overallStatus = 'partial';
}

// Empty output → error
if (validatedItems.length === 0) {
  overallStatus = 'error';
  fallbackRecommendation = 'previous_day';
  allErrors.push('No valid items after validation');
}

// ── 4. Build Quality Report ───────────────────────────────────
const report = {
  timestamp: new Date().toISOString(),  // ISO 8601
  overallStatus: overallStatus,
  summaryDeOk: deSummaryCheck.ok,
  summaryEnOk: enSummaryCheck.ok,
  deValid: deValid,
  enValid: enValid,
  totalValid: validatedItems.length,
  totalDropped: llmData.items.length - validatedItems.length,
  warnings: allWarnings,
  errors: allErrors,
  fallbackRecommendation: fallbackRecommendation,
  bucketStats: {
    de: { input: deValid + deDropped, valid: deValid, dropped: deDropped },
    en: { input: enValid + enDropped, valid: enValid, dropped: enDropped },
  },
};

console.log('[Validate v1] Report:');
console.log('  Status: ' + overallStatus);
console.log('  Valid: ' + validatedItems.length + '/' + llmData.items.length + ' (DE=' + deValid + ', EN=' + enValid + ')');
console.log('  Warnings: ' + allWarnings.length + ', Errors: ' + allErrors.length);
console.log('  Fallback recommendation: ' + fallbackRecommendation);

// ── 5. Return validated data + report ─────────────────────────
//    Items that failed validation are DROPPED (not included in output).
//    The Ingest-API receives only valid items.
//    The report is attached as _qualityReport for the next node to log + send alert.

return [{
  json: {
    ok: overallStatus !== 'error',
    items: validatedItems,  // Already cleaned of internal fields (we mutated in place)
    summaryDe: deSummaryCheck.ok ? llmData.summaryDe : (llmData.summaryDe || ''),
    summaryEn: enSummaryCheck.ok ? llmData.summaryEn : (llmData.summaryEn || ''),
    warnings: allWarnings,
    errors: allErrors,
    bucketStats: report.bucketStats,
    report: report,
  }
}];

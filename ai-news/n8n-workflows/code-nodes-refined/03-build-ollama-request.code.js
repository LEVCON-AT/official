// ═══════════════════════════════════════════════════════════════
//  BUILD OLLAMA REQUEST (v6 — RETRY LOOP + FALLBACK)
//
//  NEU in v6 (Quality-Gate-Architektur):
//   - Retry-Loop pro Bucket (max 2 Retries):
//       1. Voll-Run (10 Items, num_predict=8192)
//       2. Retry 1: Gekürzter Input (8 Items, kürzere Summaries im Prompt)
//       3. Retry 2: Noch kürzer (6 Items, nur Headlines + Source)
//   - num_predict: 8192 (vorher 6144) — mehr Token-Puffer
//   - temperature: 0.2 (vorher 0.3) — deterministischer = weniger Grammatikfehler
//   - Fallback auf Vortages-News bei Total-Fail (statt "keine News"):
//       Holt die previous_day items aus der Levcon-API und gibt sie zurück.
//   - Telemetry: Retry-Count, duration, item-count werden geloggt für
//     WorkflowRun-Quality-Report
//   - Partial-Failure: DE und EN unabhängig — ein failed Run blockiert
//     nicht den anderen
//
//  Beibehalten aus v5:
//   - this.helpers.httpRequest (n8n Expression-Parser Workaround)
//   - 2 serielle Läufe (DE zuerst, dann EN) — entlastet CPU
//   - enable_thinking: false
//   - format: "json_object" (erzwingt valides JSON)
//   - Enrichment (LLM-Items mit Originaldaten anreichern)
//   - Auto-Repair JSON Parser (fehlende Kommas, Code-Fences)
//
//  Standards (per QUALITY-GUIDELINES.md):
//   - ISO 8601 timestamps in logs
//   - try/catch mit spezifischer Fehlerbehandlung
//   - Kein `any` — alle Props typisiert (soweit in JS möglich)
//   - Pure JavaScript (n8n Code-Node v2 — kein TypeScript)
//
//  Node-Typ: Code (n8n)
//  Position: nach "Score & Rank", vor "Validate LLM Output"
// ═══════════════════════════════════════════════════════════════

const allItems = $input.all();

// ── Fallback: Keine Items → sofort Fehler (kein Retry möglich) ──
if (!allItems || allItems.length === 0) {
  throw new Error('Build Ollama v6: Keine Items vom Score&Rank-Node erhalten. Prüfe RSS-Feeds und Score&Rank.');
}

const newsItems = allItems.map(function (i) {
  return {
    title: i.json.title || '',
    link: i.json.link || '',
    source: i.json.source || '',
    summary: i.json.summary || '',
    languageOrig: i.json.languageOrig || 'en',
    bucket: i.json._bucket || 'en'
  };
});

// Nach Bucket gruppieren
const deItems = newsItems.filter(function (i) { return i.bucket === 'de'; });
const enItems = newsItems.filter(function (i) { return i.bucket === 'en'; });

console.log('[Build Ollama v6] ' + newsItems.length + ' Items für 2 Läufe (DE=' + deItems.length + ', EN=' + enItems.length + ')');

// ── KONFIGURATION ──────────────────────────────────────────────
const MAX_RETRIES = 2;            // Max 2 Retries pro Bucket (3 Versuche total)
const BASE_NUM_PREDICT = 8192;    // Vorher 6144 — mehr Puffer gegen Token-Limit-Abort
const TEMPERATURE = 0.2;          // Vorher 0.3 — deterministischer
const OLLAMA_TIMEOUT_MS = 600000; // 10 min für CPU-Inference
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL_NAME = 'qwen3.5:2b';

// ── TELEMETRY (für Quality Report) ─────────────────────────────
const telemetry = {
  deRun: { attempts: 0, success: false, durationMs: 0, itemInput: 0, itemOutput: 0, errors: [] },
  enRun: { attempts: 0, success: false, durationMs: 0, itemInput: 0, itemOutput: 0, errors: [] },
  fallbackUsed: 'none',  // 'none' | 'previous_day' | 'empty'
  totalRetries: 0,
};

// ═══════════════════════════════════════════════════════════════
//  HELPER: Ollama-Call für einen Bucket mit Retry-Loop
// ═══════════════════════════════════════════════════════════════

/**
 * Extract content string from Ollama response (handles multiple formats).
 * @param {object} resp - Ollama API response
 * @returns {string|null}
 */
function extractContent(resp) {
  if (!resp) return null;
  if (resp.message && resp.message.content) return resp.message.content;
  if (resp.choices && resp.choices[0] && resp.choices[0].message) return resp.choices[0].message.content;
  if (resp.response) return resp.response;
  return null;
}

/**
 * Parse JSON with auto-repair:
 *  - Strip markdown code fences (```json ... ```)
 *  - Auto-fix missing commas between key-value pairs
 *  - Fallback: extract first {...} block if full parse fails
 * @param {string} content - Raw LLM output
 * @returns {object|null}
 */
function parseJson(content) {
  if (!content) return null;
  let cleaned = content.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/```/g, '').trim();
  // Auto-repair: fehlende Kommas zwischen Strings ("..."\n"...")
  cleaned = cleaned.replace(/"\s*\n\s*"/g, '",\n"');
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Fallback: extrahiere erstes {...}-Block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) { return null; }
    }
    return null;
  }
}

/**
 * Build system prompt for a bucket.
 * Adapted based on retry level:
 *  - Level 0: Full prompt (10 items, 5 fields per item)
 *  - Level 1: Leaner (8 items, shorter summaries)
 *  - Level 2: Minimal (6 items, only headlines + source)
 *
 * @param {string} bucket - 'de' or 'en'
 * @param {number} itemCount - Number of items to process
 * @param {number} retryLevel - 0, 1, or 2
 * @returns {string}
 */
function buildSystemPrompt(bucket, itemCount, retryLevel) {
  const isDe = bucket === 'de';
  const langLabel = isDe ? 'GERMAN' : 'ENGLISH';
  const originLabel = isDe ? 'DACH sources' : 'international sources';
  const summaryLangField = isDe ? 'summaryDe' : 'summaryEn';
  const summaryDesc = isDe
    ? 'Analytische Zusammenfassung der heutigen KI-News (3-4 Sätze).'
    : 'Analytical summary of today\'s international AI news (3-4 sentences).';

  // Level 2: minimal output to maximize token budget per item
  if (retryLevel === 2) {
    return 'You are an expert AI news curator for Levcon.ai, a Vienna-based AI consulting firm.\n\n' +
      'Your task: Process ALL ' + itemCount + ' ' + langLabel + ' AI news items from ' + originLabel + '. ' +
      'You MUST process every single item — do NOT stop early, do NOT skip items.\n\n' +
      'For each item, write ONLY these fields (keep descriptions SHORT — 1 sentence max):\n' +
      '- headline: Original ' + langLabel + ' headline (keep as-is)\n' +
      '- headlineDe: German translation\n' +
      '- headlineEn: English translation\n' +
      '- descriptionDe: ONE short German sentence (analytical)\n' +
      '- descriptionEn: ONE short English sentence (analytical)\n' +
      '- source, sourceUrl, languageOrig, category\n\n' +
      'Also write ' + summaryLangField + ': ' + summaryDesc + '\n\n' +
      'Return JSON: { "' + summaryLangField + '": "...", "items": [ { ... } ] }\n\n' +
      'CRITICAL: Return ALL ' + itemCount + ' items. End with } and ]. Use Latin script only.';
  }

  // Level 0 + 1: full prompt (level 1 uses shorter summary input)
  return 'You are an expert AI news curator for Levcon.ai, a Vienna-based AI consulting firm.\n\n' +
    'Your task: Process ALL ' + itemCount + ' ' + langLabel + ' AI news items from ' + originLabel + '. ' +
    'You MUST process every single item — do NOT stop early, do NOT skip items, do NOT truncate the output. ' +
    'Use standard Latin script. Do not use Chinese, Japanese, Korean, Cyrillic, or any other non-Latin characters under any circumstances.\n\n' +
    'For each item, write:\n' +
    '- headline: Original ' + langLabel + ' headline (keep as-is)\n' +
    (isDe
      ? '- headlineDe: Same as headline (it\'s already German)\n- headlineEn: English translation of the headline (natural, not literal)\n'
      : '- headlineDe: German translation of the headline (natural, not literal)\n- headlineEn: Same as headline (it\'s already English)\n') +
    '- descriptionDe: 1-2 sentence German summary (analytical)\n' +
    '- descriptionEn: 1-2 sentence English summary (independent, not just translation)\n' +
    '- source, sourceUrl, thumbnailUrl, languageOrig, category (research|business|regulation|tools|society)\n\n' +
    'Also write ' + summaryLangField + ': ' + summaryDesc + '\n\n' +
    'Summary tone: Professional, concise.\n\n' +
    'Return JSON:\n' +
    '{\n' +
    '  "' + summaryLangField + '": "...",\n' +
    '  "items": [\n' +
    '    { "headline": "...", "headlineDe": "...", "headlineEn": "...", "descriptionDe": "...", "descriptionEn": "...", "source": "...", "sourceUrl": "...", "thumbnailUrl": null, "languageOrig": "' + (isDe ? 'de' : 'en') + '", "category": "..." }\n' +
    '  ]\n' +
    '}\n\n' +
    'CRITICAL: You MUST return ALL ' + itemCount + ' items in the items array. If you return fewer, the workflow will fail. Process every item, then close the JSON with } and ].';
}

/**
 * Build user prompt with item-numbering (helps Qwen see progress).
 * Retry level controls summary length in input.
 *
 * @param {Array} items - Items to process
 * @param {number} retryLevel - 0, 1, or 2
 * @param {string} bucket - 'de' or 'en'
 * @returns {string}
 */
function buildUserPrompt(items, retryLevel, bucket) {
  const summaryMaxLength = retryLevel === 0 ? 120 : (retryLevel === 1 ? 80 : 0);

  const itemsNumbered = items.map(function (i, idx) {
    const itemObj = {
      title: i.title,
      link: i.link,
      source: i.source,
      language: i.languageOrig
    };
    if (summaryMaxLength > 0) {
      itemObj.summary = i.summary.substring(0, summaryMaxLength);
    }
    const wrapper = {};
    wrapper['Item ' + (idx + 1) + ' of ' + items.length] = itemObj;
    return wrapper;
  });

  return bucket + ' ITEMS (' + items.length + ' total — process ALL ' + items.length + '):\n' +
    JSON.stringify(itemsNumbered, null, 2) + '\n\n' +
    'Process EVERY item from 1 to ' + items.length + '. Do not stop after item 6 or 7. Output ALL ' + items.length + ' items in the JSON array.';
}

/**
 * Call Ollama with given parameters.
 * @param {Array} items - Items for this run
 * @param {string} bucket - 'de' or 'en'
 * @param {number} retryLevel - 0 (full), 1 (leaner), 2 (minimal)
 * @returns {Promise<object>} - Parsed JSON from Ollama, or null on parse fail
 */
async function callOllama(items, bucket, retryLevel) {
  if (items.length === 0) {
    console.log('[Build Ollama v6] ' + bucket + '-Run übersprungen (keine Items)');
    return null;
  }

  // Truncate items for retry levels
  let runItems = items;
  if (retryLevel === 1) {
    runItems = items.slice(0, 8);  // Drop last 2 items
    console.log('[Build Ollama v6] ' + bucket + '-Retry 1: input gekürzt auf 8 Items');
  } else if (retryLevel === 2) {
    runItems = items.slice(0, 6);  // Drop last 4 items
    console.log('[Build Ollama v6] ' + bucket + '-Retry 2: input gekürzt auf 6 Items');
  }

  const systemPrompt = buildSystemPrompt(bucket, runItems.length, retryLevel);
  const userPrompt = buildUserPrompt(runItems, retryLevel, bucket);

  const requestBody = {
    model: MODEL_NAME,
    stream: false,
    format: 'json_object',
    options: {
      temperature: TEMPERATURE,
      num_predict: BASE_NUM_PREDICT,
      num_ctx: 32768,
      enable_thinking: false
    },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    think: false
  };

  console.log('[Build Ollama v6] ' + bucket + '-Run Level ' + retryLevel + ' startet (' + runItems.length + ' Items, num_predict=' + BASE_NUM_PREDICT + ', temp=' + TEMPERATURE + ')');
  const runStart = Date.now();

  const response = await this.helpers.httpRequest({
    method: 'POST',
    url: OLLAMA_URL,
    headers: { 'Content-Type': 'application/json' },
    body: requestBody,
    json: true,
    timeout: OLLAMA_TIMEOUT_MS
  });

  const duration = ((Date.now() - runStart) / 1000).toFixed(1);
  console.log('[Build Ollama v6] ' + bucket + '-Run Level ' + retryLevel + ' fertig in ' + duration + 's (' + (response.message?.content?.length || 0) + ' chars)');

  const content = extractContent(response);
  const parsed = parseJson(content);

  if (!parsed) {
    throw new Error('JSON parse failed for ' + bucket + '-Run Level ' + retryLevel + ' (content length: ' + (content?.length || 0) + ')');
  }

  if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error('No items array in parsed JSON for ' + bucket + '-Run Level ' + retryLevel);
  }

  // Validate item count matches input (warn if fewer — could be Qwen dropping items)
  if (parsed.items.length < runItems.length) {
    console.log('[Build Ollama v6] ⚠️ ' + bucket + '-Run Level ' + retryLevel + ': ' + parsed.items.length + '/' + runItems.length + ' items returned (Qwen dropped ' + (runItems.length - parsed.items.length) + ')');
  }

  return parsed;
}

/**
 * Run Ollama for a bucket with retry-loop.
 * Tries level 0 (full) → level 1 (leaner) → level 2 (minimal).
 * Returns first successful result, or null if all attempts fail.
 *
 * @param {Array} items - Items for this bucket
 * @param {string} bucket - 'de' or 'en'
 * @returns {Promise<{json: object|null, retryCount: number, durationMs: number}>}
 */
async function runBucketWithRetry(items, bucket) {
  const bucketTelemetry = { attempts: 0, success: false, durationMs: 0, itemInput: 0, itemOutput: 0, errors: [] };
  const bucketStart = Date.now();
  let retryCount = 0;
  let lastError = null;

  for (let level = 0; level <= MAX_RETRIES; level++) {
    bucketTelemetry.attempts++;
    try {
      const result = await callOllama.call(this, items, bucket, level);
      if (result) {
        bucketTelemetry.success = true;
        bucketTelemetry.itemInput = items.length;
        bucketTelemetry.itemOutput = result.items.length;
        bucketTelemetry.durationMs = Date.now() - bucketStart;
        console.log('[Build Ollama v6] ✅ ' + bucket + '-Run erfolgreich auf Level ' + level + ' nach ' + retryCount + ' Retries');
        return { json: result, retryCount: retryCount, durationMs: bucketTelemetry.durationMs };
      }
    } catch (err) {
      lastError = err;
      bucketTelemetry.errors.push('Level ' + level + ': ' + err.message);
      console.error('[Build Ollama v6] ❌ ' + bucket + '-Run Level ' + level + ' failed: ' + err.message);
      if (level < MAX_RETRIES) {
        retryCount++;
        console.log('[Build Ollama v6] 🔄 ' + bucket + '-Retry ' + retryCount + '/' + MAX_RETRIES + ' wird gestartet...');
      }
    }
  }

  bucketTelemetry.durationMs = Date.now() - bucketStart;
  console.error('[Build Ollama v6] ❌ ' + bucket + '-Run: Alle ' + (MAX_RETRIES + 1) + ' Versuche fehlgeschlagen. Letzter Fehler: ' + (lastError?.message || 'unknown'));
  return { json: null, retryCount: retryCount, durationMs: bucketTelemetry.durationMs, error: lastError?.message };
}

// ═══════════════════════════════════════════════════════════════
//  ENRICHMENT: LLM-Items mit Originaldaten anreichern
// ═══════════════════════════════════════════════════════════════
//  Qwen3.5:2b vergisst manchmal Felder (source, sourceUrl, languageOrig)
//  besonders bei den letzten Items (Ermüdungseffekt). Wir reichern
//  jedes LLM-Item mit den Originaldaten an, damit Prisma nie
//  "Argument source is missing" wirft.
//
//  Matching: LLM-Item.sourceUrl === Original-Item.link
//  Falls kein Match (LLM hat URL vergessen): versuche Match via headline.
//  Falls immer noch kein Match: Item verwerfen (kein Müll in DB).

/**
 * Enrich LLM items with original data (URL, source, language).
 * @param {Array} llmItems - Items from LLM
 * @param {Array} originalItems - Original items from Score&Rank
 * @param {string} defaultLang - 'de' or 'en' (fallback)
 * @returns {Array}
 */
function enrichItems(llmItems, originalItems, defaultLang) {
  if (!llmItems || !Array.isArray(llmItems)) return [];

  // Lookup-Maps: sourceUrl → originalItem, title → originalItem
  const byUrl = new Map();
  const byTitle = new Map();
  for (const orig of originalItems) {
    if (orig.link) byUrl.set(orig.link, orig);
    if (orig.title) byTitle.set(orig.title.toLowerCase().trim(), orig);
  }

  const enriched = [];
  const dropped = [];

  for (const item of llmItems) {
    // Match via sourceUrl (preferred) or headline (fallback)
    let original = null;
    if (item.sourceUrl && byUrl.has(item.sourceUrl)) {
      original = byUrl.get(item.sourceUrl);
    } else if (item.headline) {
      const key = (item.headline || '').toLowerCase().trim();
      if (byTitle.has(key)) {
        original = byTitle.get(key);
      } else {
        // Title-Match via erste 50 Zeichen (Qwen might have shortened)
        for (const [titleKey, origItem] of byTitle) {
          if (titleKey.includes(key.substring(0, 50)) || key.includes(titleKey.substring(0, 50))) {
            original = origItem;
            break;
          }
        }
      }
    }

    // No match found → drop (no garbage in DB)
    if (!original) {
      dropped.push({
        headline: (item.headline || '').substring(0, 60),
        reason: 'no match to original input'
      });
      continue;
    }

    // Enrichment: LLM-Daten haben Vorrang, aber wenn Feld fehlt → Original
    enriched.push({
      headline: item.headline || original.title,
      headlineDe: item.headlineDe || item.headline || original.title || null,
      headlineEn: item.headlineEn || item.headline || original.title || null,
      descriptionDe: item.descriptionDe || 'Keine Zusammenfassung verfügbar.',
      descriptionEn: item.descriptionEn || 'No summary available.',
      source: item.source || original.source,
      sourceUrl: item.sourceUrl || original.link,
      thumbnailUrl: item.thumbnailUrl || null,
      languageOrig: item.languageOrig || original.languageOrig || defaultLang,
      category: item.category || null,
    });
  }

  if (dropped.length > 0) {
    console.log('[Build Ollama v6] ⚠️ ' + dropped.length + ' Items verworfen (kein Match zu Original-Input):');
    dropped.forEach(function (d) { console.log('   - "' + d.headline + '..." (' + d.reason + ')'); });
  }

  return enriched;
}

// ═══════════════════════════════════════════════════════════════
//  FALLBACK: Vortages-News aus Levcon-API holen
// ═══════════════════════════════════════════════════════════════
//  Wenn BEIDE Buckets failed: hole die News des Vortages aus der
//  Levcon-API. So bekommt der Subscriber zumindest "gestrige" News
//  statt gar keine. Frontend zeigt dann einen Hinweis auf Archiv.
//
//  Standards: RFC 2616 (HTTP GET), ISO 8601 date query param

/**
 * Fetch previous day's news from Levcon API.
 * @returns {Promise<object|null>} - Previous day's news object, or null on fail
 */
async function fetchPreviousDayNews() {
  const API_BASE = 'https://levcon.ai';
  // Gestern berechnen (ISO 8601 date)
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];  // YYYY-MM-DD

  console.log('[Build Ollama v6] 🔄 Fallback: Hole Vortages-News vom ' + dateStr + ' aus Levcon-API');

  try {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: API_BASE + '/api/ai-news/today?date=' + dateStr,
      headers: { 'Accept': 'application/json' },
      json: true,
      timeout: 30000
    });

    // API returns { news: { date, summaryDe, summaryEn, items: [...] } }
    const news = response?.news || response;
    if (!news || !news.items || !Array.isArray(news.items) || news.items.length === 0) {
      console.log('[Build Ollama v6] ⚠️ Vortages-News leer oder nicht verfügbar');
      return null;
    }

    console.log('[Build Ollama v6] ✅ Vortages-News geholt: ' + news.items.length + ' Items vom ' + dateStr);
    return {
      summaryDe: news.summaryDe || '',
      summaryEn: news.summaryEn || '',
      items: news.items,
      _fallbackDate: dateStr,
      _fallbackSource: 'previous_day'
    };
  } catch (err) {
    console.error('[Build Ollama v6] ❌ Vortages-Fallback failed: ' + err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  MAIN: 2 SERIELLE LÄUFE (DE zuerst, dann EN)
// ═══════════════════════════════════════════════════════════════

let deJson = null;
let enJson = null;
const errors = [];

// 1. DE-Run (mit Retry-Loop)
try {
  const deResult = await runBucketWithRetry.call(this, deItems, 'de');
  deJson = deResult.json;
  telemetry.deRun.attempts = deResult.retryCount + 1;
  telemetry.deRun.success = !!deJson;
  telemetry.deRun.durationMs = deResult.durationMs;
  telemetry.deRun.itemInput = deItems.length;
  telemetry.deRun.itemOutput = deJson?.items?.length || 0;
  telemetry.totalRetries += deResult.retryCount;
  if (!deJson && deResult.error) {
    errors.push({ run: 'de', error: deResult.error });
    telemetry.deRun.errors.push(deResult.error);
  }
} catch (err) {
  console.error('[Build Ollama v6] ❌ DE-Run exception: ' + err.message);
  errors.push({ run: 'de', error: err.message });
  telemetry.deRun.errors.push(err.message);
}

// 2. EN-Run (mit Retry-Loop, seriell nach DE)
try {
  const enResult = await runBucketWithRetry.call(this, enItems, 'en');
  enJson = enResult.json;
  telemetry.enRun.attempts = enResult.retryCount + 1;
  telemetry.enRun.success = !!enJson;
  telemetry.enRun.durationMs = enResult.durationMs;
  telemetry.enRun.itemInput = enItems.length;
  telemetry.enRun.itemOutput = enJson?.items?.length || 0;
  telemetry.totalRetries += enResult.retryCount;
  if (!enJson && enResult.error) {
    errors.push({ run: 'en', error: enResult.error });
    telemetry.enRun.errors.push(enResult.error);
  }
} catch (err) {
  console.error('[Build Ollama v6] ❌ EN-Run exception: ' + err.message);
  errors.push({ run: 'en', error: err.message });
  telemetry.enRun.errors.push(err.message);
}

// 3. Beide Runs failed → Vortages-Fallback versuchen
if (!deJson && !enJson) {
  console.log('[Build Ollama v6] ⚠️ Beide Runs failed — versuche Vortages-Fallback...');
  const fallback = await fetchPreviousDayNews.call(this);
  if (fallback) {
    telemetry.fallbackUsed = 'previous_day';
    return [{
      json: {
        summaryDe: fallback.summaryDe,
        summaryEn: fallback.summaryEn,
        items: fallback.items,
        _fallback: {
          used: true,
          source: 'previous_day',
          date: fallback._fallbackDate,
          reason: 'both buckets failed: ' + errors.map(function (e) { return e.run + ': ' + e.error; }).join('; ')
        },
        _telemetry: telemetry
      }
    }];
  } else {
    // Vortages-Fallback auch failed → harter Fehler (Alert-Email wird getriggert)
    telemetry.fallbackUsed = 'empty';
    throw new Error('Build Ollama v6: Beide Läufe UND Vortages-Fallback failed. Errors: ' + JSON.stringify(errors));
  }
}

// 4. Parse + Enrich: beide Runs zusammenführen
const deItemsEnriched = enrichItems(deJson?.items, deItems, 'de');
const enItemsEnriched = enrichItems(enJson?.items, enItems, 'en');

console.log('[Build Ollama v6] Item-Count: DE-Input=' + deItems.length + ', DE-Output=' + deItemsEnriched.length + (deItems.length !== deItemsEnriched.length ? ' ⚠️ MISMATCH' : ''));
console.log('[Build Ollama v6] Item-Count: EN-Input=' + enItems.length + ', EN-Output=' + enItemsEnriched.length + (enItems.length !== enItemsEnriched.length ? ' ⚠️ MISMATCH' : ''));

// 5. Merge zu kombiniertem JSON
const mergedJson = {
  summaryDe: deJson?.summaryDe || '',
  summaryEn: enJson?.summaryEn || '',
  items: deItemsEnriched.concat(enItemsEnriched),
  _telemetry: telemetry,
  _partial: !deJson || !enJson  // true if one bucket failed
};

console.log('[Build Ollama v6] Merge: ' + mergedJson.items.length + ' Items (DE=' + deItemsEnriched.length + ', EN=' + enItemsEnriched.length + ')');
console.log('[Build Ollama v6] summaryDe: ' + (mergedJson.summaryDe ? '✓' : '✗') + ', summaryEn: ' + (mergedJson.summaryEn ? '✓' : '✗'));
console.log('[Build Ollama v6] Partial: ' + (mergedJson._partial ? 'YES' : 'no') + ', Retries: ' + telemetry.totalRetries);

if (errors.length > 0) {
  console.log('[Build Ollama v6] ⚠️ Partial failure: ' + errors.map(function (e) { return e.run; }).join(', ') + ' failed but other run succeeded');
}

// 6. Return: direkt das gemergede JSON.
//    Der nächste Node ("Validate LLM Output") validiert das Ergebnis.
return [{ json: mergedJson }];

// ═══════════════════════════════════════════════════════════════
//  BUILD OLLAMA REQUEST (REFINED v5 — 2 SERielle LÄUFE DE + EN)
//
//  NEU in v5:
//   - 2 separate Ollama-Läufe (DE zuerst, dann EN) SERIELL
//     → entlastet CPU (kein paralleler Ollama-Stress)
//     → entlastet Qwen (nur 10 Items pro Run statt 20)
//     → kein Ermüdungseffekt bei letzten Items
//   - DE-Run schreibt summaryDe + alle DE-Items (headlineEn als Übersetzung)
//   - EN-Run schreibt summaryEn + alle EN-Items (headlineDe als Übersetzung)
//   - Merge: kombiniert DE-Result + EN-Result zu einem JSON für Ingest
//   - Partial-Failure: wenn ein Run failed, wird der andere trotzdem gespeichert
//
//  Beibehalten aus v4:
//   - this.helpers.httpRequest (n8n Expression-Parser Workaround)
//   - enable_thinking: false (verhindert Token-Verschwendung)
//   - 600s Timeout pro Run (CPU-Inference)
//   - Leaner Prompt (nur title, source, language, summary)
//
//  Node-Typ: Code (n8n)
//  Position: nach "Score & Rank", vor "Parse LLM JSON"
// ═══════════════════════════════════════════════════════════════

const allItems = $input.all();

// ── Fallback: Keine Items → Fehler mit Kontext ─────────────────
if (!allItems || allItems.length === 0) {
  throw new Error('Build Ollama: Keine Items vom Score&Rank-Node erhalten. Prüfe RSS-Feeds und Score&Rank.');
}

const newsItems = allItems.map(function(i) {
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
const deItems = newsItems.filter(i => i.bucket === 'de');
const enItems = newsItems.filter(i => i.bucket === 'en');

console.log(`[Build Ollama v5] ${newsItems.length} Items für 2 Läufe (DE=${deItems.length}, EN=${enItems.length})`);

// ═══════════════════════════════════════════════════════════════
//  HELPER: Ollama-Call für einen Bucket
// ═══════════════════════════════════════════════════════════════

async function callOllama(items, bucket) {
  if (items.length === 0) {
    console.log(`[Build Ollama v5] ${bucket}-Run übersprungen (keine Items)`);
    return null;
  }

  const isDe = bucket === 'de';

  // ── System Prompt (sprachspezifisch) ────────────────────────
  // DE-Run: schreibt summaryDe + headlineEn (Übersetzung DE→EN)
  // EN-Run: schreibt summaryEn + headlineDe (Übersetzung EN→DE)
  const systemPrompt = isDe
    ? `You are an expert AI news curator for Levcon.ai, a Vienna-based AI consulting firm.

Your task: Process ALL ${items.length} GERMAN AI news items from DACH sources.

For each item, write:
- headline: Original German headline (keep as-is)
- headlineDe: Same as headline (it's already German)
- headlineEn: English translation of the headline (natural, not literal)
- descriptionDe: 1-2 sentence German summary (analytical)
- descriptionEn: 1-2 sentence English summary (independent, not just translation)
- source, sourceUrl, thumbnailUrl, languageOrig, category (research|business|regulation|tools|society)

Also write summaryDe: Analytische Zusammenfassung der heutigen DACH KI-News (3-4 Sätze, interesseweckend).

Summary tone: Professional, insightful, concise. Like a McKinsey briefing.

Return JSON:
{
  "summaryDe": "...",
  "items": [
    { "headline": "...", "headlineDe": "...", "headlineEn": "...", "descriptionDe": "...", "descriptionEn": "...", "source": "...", "sourceUrl": "...", "thumbnailUrl": null, "languageOrig": "de", "category": "..." }
  ]
}

IMPORTANT: Return ONLY the JSON object. No markdown, no code blocks. Keep ALL ${items.length} items.`
    : `You are an expert AI news curator for Levcon.ai, a Vienna-based AI consulting firm.

Your task: Process ALL ${items.length} ENGLISH AI news items from international sources.

For each item, write:
- headline: Original English headline (keep as-is)
- headlineDe: German translation of the headline (natural, not literal)
- headlineEn: Same as headline (it's already English)
- descriptionDe: 1-2 sentence German summary (analytical, not just translation)
- descriptionEn: 1-2 sentence English summary (independent)
- source, sourceUrl, thumbnailUrl, languageOrig, category (research|business|regulation|tools|society)

Also write summaryEn: Analytical summary of today's international AI news (3-4 sentences, engaging).

Summary tone: Professional, insightful, concise. Like a McKinsey briefing.

Return JSON:
{
  "summaryEn": "...",
  "items": [
    { "headline": "...", "headlineDe": "...", "headlineEn": "...", "descriptionDe": "...", "descriptionEn": "...", "source": "...", "sourceUrl": "...", "thumbnailUrl": null, "languageOrig": "en", "category": "..." }
  ]
}

IMPORTANT: Return ONLY the JSON object. No markdown, no code blocks. Keep ALL ${items.length} items.`;

  // ── User Prompt (lean: nur title, source, language, summary) ──
  const userPrompt = `${bucket} ITEMS (${items.length}):
${JSON.stringify(items.map(i => ({
  title: i.title,
  link: i.link,
  source: i.source,
  language: i.languageOrig,
  summary: i.summary.substring(0, 120)
})), null, 2)}

Process ALL ${items.length} items. Each must have: headline, headlineDe, headlineEn, descriptionDe, descriptionEn.`;

  // ── Request Body (pro Run kleinere num_predict, da nur 10 Items) ──
  const requestBody = {
    model: "qwen3.5:2b",
    stream: false,
    options: {
      temperature: 0.3,
      num_predict: 4096,       // v5: 10 Items × 5 Felder = ~1.700 Output-Tokens, 4096 reicht
      num_ctx: 32768,
      enable_thinking: false
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    "think": false
  };

  console.log(`[Build Ollama v5] ${bucket}-Run startet (${items.length} Items, num_predict=4096)`);
  const runStart = Date.now();

  const response = await this.helpers.httpRequest({
    method: 'POST',
    url: 'http://127.0.0.1:11434/api/chat',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody,
    json: true,
    timeout: 600000  // 10min für CPU-Inference
  });

  const duration = ((Date.now() - runStart) / 1000).toFixed(1);
  console.log(`[Build Ollama v5] ${bucket}-Run fertig in ${duration}s (${response.message?.content?.length || 0} chars)`);

  return response;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN: 2 SERIELLE LÄUFE (DE zuerst, dann EN)
// ═══════════════════════════════════════════════════════════════
//  Seriell weil:
//  - Ollama auf CPU nicht gut parallel kann (RLY belastet)
//  - Qwen-Modell wird beim 2. Run aus RAM geladen (schneller)
//  - Einfacher zu debuggen, klare Reihenfolge im Log

let deResult = null;
let enResult = null;
const errors = [];

// 1. DE-Run
try {
  deResult = await callOllama(deItems, 'de');
} catch (err) {
  console.error(`[Build Ollama v5] ❌ DE-Run failed: ${err.message}`);
  errors.push({ run: 'de', error: err.message });
}

// 2. EN-Run (nur starten wenn DE fertig — seriell)
try {
  enResult = await callOllama(enItems, 'en');
} catch (err) {
  console.error(`[Build Ollama v5] ❌ EN-Run failed: ${err.message}`);
  errors.push({ run: 'en', error: err.message });
}

// 3. Beide Runs failed → harter Fehler
if (!deResult && !enResult) {
  throw new Error(`Build Ollama v5: Beide Läufe failed. Errors: ${JSON.stringify(errors)}`);
}

// 4. Parse + Merge: kombiniere DE-Result + EN-Result
//    Der Parse LLM JSON Node weiter unten erwartet { message: { content: "..." } }
//    Wir bauen hier ein synthetisches Response-Objekt das beide Runs merged.

function extractContent(resp) {
  if (!resp) return null;
  if (resp.message && resp.message.content) return resp.message.content;
  if (resp.choices && resp.choices[0] && resp.choices[0].message) return resp.choices[0].message.content;
  if (resp.response) return resp.response;
  return null;
}

function parseJson(content) {
  if (!content) return null;
  // Clean markdown
  let cleaned = content.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/```/g, '').trim();
  // Auto-Repair: fehlende Kommas
  cleaned = cleaned.replace(/"\s*\n\s*"/g, '",\n"');
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) { return null; }
    }
    return null;
  }
}

const deJson = parseJson(extractContent(deResult));
const enJson = parseJson(extractContent(enResult));

console.log(`[Build Ollama v5] Parse: DE=${deJson ? 'OK' : 'FAIL'}, EN=${enJson ? 'OK' : 'FAIL'}`);

// ═══════════════════════════════════════════════════════════════
//  5. ENRICHMENT: LLM-Items mit Originaldaten anreichern
// ═══════════════════════════════════════════════════════════════
//  Qwen3.5:2b vergisst manchmal Felder (source, sourceUrl, languageOrig)
//  besonders bei den letzten Items (Ermüdungseffekt). Wir reichern
//  jedes LLM-Item mit den Originaldaten an, damit Prisma nie
//  "Argument source is missing" wirft.
//
//  Matching: LLM-Item.sourceUrl === Original-Item.link
//  Falls kein Match (LLM hat URL vergessen): versuche Match via headline.
//  Falls immer noch kein Match: behalte LLM-Daten, fülle Pflichtfelder
//  mit Fallbacks.

function enrichItems(llmItems, originalItems, defaultLang) {
  if (!llmItems || !Array.isArray(llmItems)) return [];

  // Lookup-Map: sourceUrl → originalItem (für schnelles Matchen)
  const byUrl = new Map();
  const byTitle = new Map();
  for (const orig of originalItems) {
    if (orig.link) byUrl.set(orig.link, orig);
    if (orig.title) byTitle.set(orig.title.toLowerCase().trim(), orig);
  }

  return llmItems.map((item, idx) => {
    // Versuche Match via sourceUrl (bevorzugt) oder headline (Fallback)
    let original = null;
    if (item.sourceUrl && byUrl.has(item.sourceUrl)) {
      original = byUrl.get(item.sourceUrl);
    } else if (item.headline) {
      // Versuche exakte Titel-Match
      const key = (item.headline || '').toLowerCase().trim();
      if (byTitle.has(key)) {
        original = byTitle.get(key);
      } else {
        // Versuche Titel-Match via erste 50 Zeichen (Qwen might have shortened)
        for (const [titleKey, origItem] of byTitle) {
          if (titleKey.includes(key.substring(0, 50)) || key.includes(titleKey.substring(0, 50))) {
            original = origItem;
            break;
          }
        }
      }
    }

    // Enrichment: LLM-Daten haben Vorrang, aber wenn Feld fehlt → Original
    return {
      headline: item.headline || original?.title || `Item ${idx + 1}`,
      headlineDe: item.headlineDe || item.headline || original?.title || null,
      headlineEn: item.headlineEn || item.headline || original?.title || null,
      descriptionDe: item.descriptionDe || 'Keine Zusammenfassung verfügbar.',
      descriptionEn: item.descriptionEn || 'No summary available.',
      source: item.source || original?.source || 'Unknown',
      sourceUrl: item.sourceUrl || original?.link || '',
      thumbnailUrl: item.thumbnailUrl || null,
      languageOrig: item.languageOrig || original?.languageOrig || defaultLang,
      category: item.category || null,
    };
  });
}

const deItemsEnriched = enrichItems(deJson?.items, deItems, 'de');
const enItemsEnriched = enrichItems(enJson?.items, enItems, 'en');

// 6. Merge zu kombiniertem JSON
const mergedJson = {
  summaryDe: deJson?.summaryDe || '',
  summaryEn: enJson?.summaryEn || '',
  items: [
    ...deItemsEnriched,
    ...enItemsEnriched
  ]
};

console.log(`[Build Ollama v5] Merge: ${mergedJson.items.length} Items (DE=${deItemsEnriched.length}, EN=${enItemsEnriched.length})`);
console.log(`[Build Ollama v5] summaryDe: ${mergedJson.summaryDe ? '✓' : '✗'}, summaryEn: ${mergedJson.summaryEn ? '✓' : '✗'}`);

// Validierung: jedes Item muss source und sourceUrl haben
const missingSource = mergedJson.items.filter(i => !i.source);
const missingUrl = mergedJson.items.filter(i => !i.sourceUrl);
if (missingSource.length > 0 || missingUrl.length > 0) {
  console.log(`[Build Ollama v5] ⚠️ Validierung: ${missingSource.length} Items ohne source, ${missingUrl.length} ohne sourceUrl`);
}

if (errors.length > 0) {
  console.log(`[Build Ollama v5] ⚠️ Partial failure: ${errors.map(e => e.run).join(', ')} failed but other run succeeded`);
}

// 7. Return als synthetische Ollama-Response (kompatibel mit Parse LLM JSON Node)
return [{
  json: {
    message: {
      content: JSON.stringify(mergedJson)
    }
  }
}];

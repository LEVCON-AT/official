// ═══════════════════════════════════════════════════════════════
//  BUILD OLLAMA REQUEST (REFINED v4 — DE/EN ONLY, LEANER PROMPT)
//
//  NEU in v4:
//   1. 20 Items (10 DE + 10 EN) statt 30 — entlastet Qwen
//   2. num_predict 8192 → 6144 (weniger Output nötig)
//   3. Score + scoreReasons aus User-Prompt entfernt (Qwen soll nur
//      summarisieren, nicht kuratieren — braucht das Ranking nicht)
//   4. origin: 'rss' wird nicht mehr an Qwen gesendet (unnötig)
//   5. Prompt text "Keep ALL items" angepasst auf 20 Items
//
//  Beibehalten aus v3:
//   - this.helpers.httpRequest (n8n Expression-Parser Workaround)
//   - enable_thinking: false (verhindert Token-Verschwendung)
//   - 600s Timeout für CPU-Inference
//   - headlineDe + headlineEn Übersetzungen
//
//  Node-Typ: Code (n8n)
//  Position: nach "Score & Rank", vor "Parse LLM JSON"
// ═══════════════════════════════════════════════════════════════

const allItems = $input.all();

// ── Fallback: Keine Items → Fehler mit Kontext ─────────────────
if (!allItems || allItems.length === 0) {
  throw new Error('Build Ollama Request: Keine Items vom Score&Rank-Node erhalten. Prüfe ob RSS-Feeds erreichbar waren und Score&Rank korrekt lief.');
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

console.log(`[Build Ollama] ${newsItems.length} Items für LLM (DE=${deItems.length}, EN=${enItems.length})`);

// ── System Prompt (summarisieren + headline-übersetzen) ────────
const systemPrompt = `You are an expert AI news curator for Levcon.ai, a Vienna-based AI consulting firm.

Your task: Write german AND english headlines AND summaries for ALL ${newsItems.length} provided news items. The items are ALREADY pre-selected with a language quota:
- ${deItems.length} German items (from DACH sources)
- ${enItems.length} English items (from international sources)

CRITICAL: Keep ALL ${newsItems.length} items in your output. Do NOT remove, filter, or re-select items. The pre-selection is intentional for an Austrian site.

For each item, write:
- headline: Original headline (keep as-is, do not modify)
- headlineDe: German translation of the headline (natural, not literal)
- headlineEn: English translation of the headline (natural, not literal)
- descriptionDe: 1-2 sentence German summary (analytical, not just translation)
- descriptionEn: 1-2 sentence English summary (independent, not just translation)
- category: research | business | regulation | tools | society
- languageOrig: keep the original language code (de, en)

Headline translation rules:
- If original is German: headlineDe = original, headlineEn = English translation
- If original is English: headlineDe = German translation, headlineEn = original
- Translations should sound natural in the target language, not word-for-word
- Keep technical terms (GPT, LLM, AI, KI) in their established form
- Preserve proper names (OpenAI, Anthropic, companies, product names)

For the daily summary, write ANALYTICALLY — not just "X happened":
- Identify the overarching theme of the day
- Explain WHY these stories matter together
- Consider both DACH and international perspective

Summary tone: Professional, insightful, concise. Like a McKinsey briefing, not a press release.

Return JSON:
{
  "summaryDe": "Analytische Zusammenfassung auf Deutsch (4-6 Sätze, internationale Perspektive)",
  "summaryEn": "Analytical summary in English (4-6 sentences, international perspective)",
  "items": [
    {
      "headline": "Original headline (original language, keep as-is)",
      "headlineDe": "Deutsche Übersetzung des Titels (natürlich, nicht wörtlich)",
      "headlineEn": "English translation of the headline (natural, not literal)",
      "descriptionDe": "Deutsche Zusammenfassung (1-2 Sätze)",
      "descriptionEn": "English summary (1-2 sentences)",
      "source": "Publisher name (e.g. 'Heise', 'MIT Tech Review')",
      "sourceUrl": "Full URL to original article",
      "thumbnailUrl": "Thumbnail URL or null",
      "languageOrig": "de|en",
      "category": "research|business|regulation|tools|society"
    }
  ]
}

IMPORTANT: Return ONLY the JSON object. No markdown, no code blocks, no explanations. Keep ALL ${newsItems.length} items. Every item must have headline, headlineDe, AND headlineEn.`;

// ── User Prompt (LEAN: nur title, source, language, summary — kein score, kein origin) ──
// Reduziert Input-Tokens um ~30% vs v3.
function formatBucket(items, label) {
  if (items.length === 0) return `${label}: (none)`;
  return `${label}:\n${JSON.stringify(items.map(i => ({
    title: i.title,
    link: i.link,
    source: i.source,
    language: i.languageOrig,
    summary: i.summary.substring(0, 120)
  })), null, 2)}`;
}

const userPrompt = `Today's ${newsItems.length} pre-selected AI news items (language quota applied, all must be included in output):

${formatBucket(deItems, `GERMAN ITEMS (${deItems.length})`)}

${formatBucket(enItems, `ENGLISH ITEMS (${enItems.length})`)}

Write german + english headlines AND summaries for ALL ${newsItems.length} items. Keep every item. Do not filter or re-rank. Each item must have: headline (original), headlineDe, headlineEn, descriptionDe, descriptionEn.`;

// ── Ollama Request Body (v4: num_predict 6144 für 20 Items) ────
// Token-Kalkulation v4:
//   20 Items × (headline + headlineDe + headlineEn + descDe + descEn + metadata)
//   = 20 × ~170 Tokens = ~3.400 Output-Tokens
//   + summaryDe + summaryEn ~400 = ~3.800 Output-Tokens gesamt
//   num_predict 6144 gibt ausreichend Puffer.
const requestBody = {
  model: "qwen3.5:2b",
  stream: false,
  options: {
    temperature: 0.3,
    num_predict: 6144,       // v4: reduziert von 8192 (20 Items statt 30)
    num_ctx: 32768,
    enable_thinking: false
  },
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  "think": false
};

// Token-Schätzung für Logging
const inputTokensEst = Math.round((systemPrompt.length + userPrompt.length) / 4);
console.log(`[Build Ollama] Request gebaut: ${newsItems.length} Items, ~${inputTokensEst} Input-Tokens geschätzt, num_predict=6144`);

// ── Ollama API Call (mit langem Timeout für CPU-Inference) ─────
const response = await this.helpers.httpRequest({
  method: 'POST',
  url: 'http://127.0.0.1:11434/api/chat',
  headers: { 'Content-Type': 'application/json' },
  body: requestBody,
  json: true,
  timeout: 600000
});

console.log(`[Build Ollama] Ollama-Antwort erhalten (${response.message?.content?.length || 0} chars)`);

return [{ json: response }];

// ═══════════════════════════════════════════════════════════════
//  BUILD OLLAMA REQUEST (REFINED v3 — LANGUAGE QUOTA + TRANSLATED HEADLINES)
//
//  NEU in v3:
//   1. Akzeptiert 30 Items (10 DE + 10 EN + 10 INTL) statt 15
//   2. num_predict erhöht: 4096 → 8192 (für 30 Items Output)
//   3. Prompt geändert: LLM soll NICHT kuratieren, nur summarisieren
//      → "Keep ALL items, write summaries for each"
//   4. Items werden im Prompt nach Bucket gruppiert (DE/EN/INTL)
//   5. Summary-Token gekürzt: 150 → 120 Zeichen (Context sparen bei 30 Items)
//   6. NEU: Headlines werden auch nach DE + EN übersetzt
//      → Output enthält headline (original), headlineDe, headlineEn
//
//  Beibehalten aus v2:
//   - this.helpers.httpRequest (n8n Expression-Parser Workaround)
//   - enable_thinking: false (verhindert Token-Verschwendung)
//   - 600s Timeout für CPU-Inference
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
    pubDate: i.json.pubDate || '',
    summary: i.json.summary || '',
    languageOrig: i.json.languageOrig || 'en',
    score: i.json._score || 0,
    bucket: i.json._bucket || 'en'  // de | en | intl
  };
});

// Nach Bucket gruppieren (für strukturierten Prompt)
const deItems = newsItems.filter(i => i.bucket === 'de');
const enItems = newsItems.filter(i => i.bucket === 'en');
const intlItems = newsItems.filter(i => i.bucket === 'intl');

console.log(`[Build Ollama] ${newsItems.length} Items für LLM (DE=${deItems.length}, EN=${enItems.length}, INTL=${intlItems.length})`);
console.log(`[Build Ollama] Score-Range: ${Math.min(...newsItems.map(i=>i.score))}-${Math.max(...newsItems.map(i=>i.score))}`);

// ── System Prompt (NEU: summarisieren + headline-übersetzen, nicht kuratieren) ─
// Das kleine qwen3.5:2b-Modell ist besser im Schreiben als im Auswählen.
// Score&Rank hat bereits die beste Auswahl getroffen — Qwen muss nur
// noch DE+EN Headlines + Beschreibungen für jedes Item schreiben.
const systemPrompt = `You are an expert AI news curator for Levcon.ai, a Vienna-based AI consulting firm.

Your task: Write german AND english headlines AND summaries for ALL ${newsItems.length} provided news items. The items are ALREADY pre-selected with a language quota:
- ${deItems.length} German items (from DACH sources)
- ${enItems.length} English items (from international sources)
- ${intlItems.length} International items (Chinese, Japanese, French, etc.)

CRITICAL: Keep ALL ${newsItems.length} items in your output. Do NOT remove, filter, or re-select items. The pre-selection is intentional for an Austrian site with international perspective.

For each item, write:
- headline: Original headline (keep as-is, do not modify)
- headlineDe: German translation of the headline (natural, not literal — adapt for German readers)
- headlineEn: English translation of the headline (natural, not literal — adapt for English readers)
- descriptionDe: 1-2 sentence German summary (analytical, not just translation)
- descriptionEn: 1-2 sentence English summary (independent, not just translation)
- category: research | business | regulation | tools | society
- languageOrig: keep the original language code (de, en, zh, ja, fr, etc.)

Headline translation rules:
- If original is German: headlineDe = original, headlineEn = English translation
- If original is English: headlineDe = German translation, headlineEn = original
- If original is Chinese/Japanese/French/etc.: translate to BOTH German and English
- Translations should sound natural in the target language, not word-for-word
- Keep technical terms (GPT, LLM, AI, KI) in their established form
- Preserve proper names (OpenAI, Anthropic, companies, product names)

For the daily summary, write ANALYTICALLY — not just "X happened":
- Identify the overarching theme of the day
- Explain WHY these stories matter together
- Give the reader a reason to click and read more
- Consider the international perspective (DACH + global + Asian + European)

Summary tone: Professional, insightful, concise. Like a McKinsey briefing, not a press release.

Return JSON:
{
  "summaryDe": "Analytische Zusammenfassung auf Deutsch (4-6 Sätze, interesseweckend, internationale Perspektive)",
  "summaryEn": "Analytical summary in English (4-6 sentences, engaging, international perspective)",
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
      "languageOrig": "de|en|zh|ja|fr|es|it|pt",
      "category": "research|business|regulation|tools|society"
    }
  ]
}

IMPORTANT: Return ONLY the JSON object. No markdown, no code blocks, no explanations. Keep ALL ${newsItems.length} items. Every item must have headline, headlineDe, AND headlineEn.`;

// ── User Prompt (NEU: nach Bucket gruppiert) ───────────────────
// Items nach Bucket sortiert ins Prompt aufnehmen, damit Qwen die
// Struktur versteht. Summary auf 120 Zeichen gekürzt (Context sparen).
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

${formatBucket(intlItems, `INTERNATIONAL ITEMS (${intlItems.length})`)}

Write german + english headlines AND summaries for ALL ${newsItems.length} items. Keep every item. Do not filter or re-rank. Each item must have: headline (original), headlineDe, headlineEn, descriptionDe, descriptionEn.`;

// ── Ollama Request Body (NEU: num_predict 8192 für 30 Items + headline-Übersetzung) ─
// Token-Kalkulation mit headlineDe + headlineEn:
//   30 Items × (headline + headlineDe + headlineEn + descDe + descEn + metadata)
//   = 30 × ~170 Tokens = ~5.100 Output-Tokens
//   + summaryDe + summaryEn ~400 = ~5.500 Output-Tokens gesamt
//   num_predict 8192 gibt ausreichend Puffer.
const requestBody = {
  model: "qwen3.5:2b",
  stream: false,
  options: {
    temperature: 0.3,        // Deterministisch genug für JSON, kreativ genug für Summary
    num_predict: 8192,       // Für 30 Items × 5 Text-Felder (headline, headlineDe, headlineEn, descDe, descEn)
    num_ctx: 32768,          // Großzügiger Context (30 Items × ~100 Tokens = 3000 + Prompt)
    enable_thinking: false   // Verhindert Token-Verschwendung im thinking mode
  },
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  "think": false  // Double-Safety: thinking mode auch auf Top-Level deaktiviert
};

// Token-Schätzung für Logging
const inputTokensEst = Math.round((systemPrompt.length + userPrompt.length) / 4);
console.log(`[Build Ollama] Request gebaut: ${newsItems.length} Items, ~${inputTokensEst} Input-Tokens geschätzt, num_predict=8192`);

// ── Ollama API Call (mit langem Timeout für CPU-Inference) ─────
// Timeout 600s (10min) — Qwen3.5:2b auf CPU kann bei 30 Items 3-5min brauchen.
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

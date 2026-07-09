// ═══════════════════════════════════════════════════════════════
//  SCORE & RANK — Relevanz-Scoring für KI-News
//  Ersetzt das blinde slice(0, 20).
//  Zweck: Aus ~50-100 deduplizierten Items die besten ~15-20
//         auswählen, damit das kleine qwen3.5:2b-Modell nicht
//         überfordert wird.
//
//  Score-Faktoren:
//    1. Quellen-Gewichtung (Qualität aus SOURCES.md)
//    2. Frische-Bonus (neuere Items > ältere)
//    3. Keyword-Qualität (Treffer im Titel > Treffer in Summary)
//    4. Längen-Penalty (zu kurz = wenig Substanz, zu lang = Klickbait)
//    5. Spam/Klickbait-Penalty
//
//  Node-Typ: Code (n8n)
//  Position im Workflow: nach "Dedupe by URL", vor "Build Ollama Request"
// ═══════════════════════════════════════════════════════════════

// ── KONFIGURATION ──────────────────────────────────────────────
const TOP_N = 15;              // Wieviele Items ans LLM senden? (qwen3.5:2b verträgt ~15-20 gut)
const MAX_AGE_HOURS = 48;      // Items älter als X Std. werden bestraft
// ─────────────────────────────────────────────────────────────────

// ── 1. QUELLEN-GEWICHTUNG ──────────────────────────────────────
// Werte aus SOURCES.md Qualität-Spalte + redaktioneller Erfahrung.
// 1.0 = sehr hoch (Premium-Forschung/Leitmedien)
// 0.85 = hoch (etablierte Tech-Presse)
// 0.7 = mittel (Nischen/Blogs)
// 0.5 = niedrig (Startups/Aggregatoren)
const SOURCE_WEIGHTS = {
  // Sehr hoch (1.0)
  'MIT Tech Review': 1.0,
  'Ars Technica': 1.0,
  'Tagesschau': 1.0,
  'Süddeutsche Zeitung': 1.0,
  'arXiv cs.AI': 1.0,
  'arXiv cs.LG': 1.0,
  'arXiv cs.CL': 1.0,
  'Nature': 1.0,
  // Hoch (0.85)
  'Heise': 0.85,
  'Golem': 0.85,
  'The Verge': 0.85,
  'Anthropic': 0.85,
  'OpenAI': 0.85,
  'Hugging Face': 0.85,
  'Der Standard': 0.85,
  'ZDNet': 0.85,
  'TechCrunch': 0.85,
  'VentureBeat': 0.85,
  'Wired': 0.85,
  // Mittel (0.7) — internationale / Nischen
  'Synced': 0.7,
  'Caixin Global': 0.7,
  'Pandaily': 0.7,
  'TechNode': 0.7,
  'ITmedia': 0.7,
  'Nikkei Tech': 0.7,
  'ASCII.jp': 0.7,
  "L'Usine Digitale": 0.7,
  'Le Journal du Net': 0.7,
  'ActuIA': 0.7,
  'MarkTechPost': 0.7,
  'Towards Data Science': 0.7,
  'The Information': 0.7,
  // Niedrig (0.5) — deutschsprachige Blogs/Aggregatoren
  'Mixed.de': 0.5,
  'AInauten': 0.5,
  'Netzwelt': 0.5,
  'KI-Campus': 0.5,
};

// ── 2. KEYWORD-KATEGORIEN ──────────────────────────────────────
// Hochwertige KI-Keywords (Treffer im Titel = starker Relevanz-Indikator)
const HIGH_VALUE_KEYWORDS = /\b(LLM|GPT|Claude|Gemini|Llama|transformer|diffusion|multimodal|AGI|MoE|RLHF|alignment|EU AI Act|AI Act|regulation|OpenAI|Anthropic|Google AI|Mistral|DeepSeek|Qwen|Nvidia|multimodal)\b/i;
// Allgemeine KI-Keywords (für Basis-Relevanz, aber weniger stark)
const GENERAL_KI_KEYWORDS = /\b(AI|KI|ML|neural|machine learning|deep learning|generative|model|chatbot|inference|training)\b/i;

// ── 3. KLICKBAIT / SPAM-PATTERNS ───────────────────────────────
const CLICKBAIT_PATTERNS = /\b(you won't believe|shocking|amazing|incredible|mind-blowing|\d+ (best|top|amazing) (ai|tools)|click here|read more|sponsored|advertisement)\b/i;

// ═══════════════════════════════════════════════════════════════
//  SCORING-FUNKTION
// ═══════════════════════════════════════════════════════════════

function scoreItem(item) {
  const title = (item.title || '').trim();
  const summary = (item.summary || '').trim();
  const source = item.source || 'Unknown';
  const pubDateStr = item.pubDate || '';
  const link = item.link || '';

  let score = 0;
  const reasons = [];

  // ── Faktor 1: Quellen-Gewichtung (Basis-Score) ───────────────
  const sourceWeight = SOURCE_WEIGHTS[source] !== undefined ? SOURCE_WEIGHTS[source] : 0.5;
  score += sourceWeight * 40;  // max 40 Punkte
  if (sourceWeight >= 1.0) reasons.push(`Top-Quelle (${source})`);
  else if (sourceWeight < 0.6) reasons.push(`Schwache Quelle (${source})`);

  // ── Faktor 2: Keyword-Qualität ───────────────────────────────
  const titleHasHighValue = HIGH_VALUE_KEYWORDS.test(title);
  const titleHasGeneral = GENERAL_KI_KEYWORDS.test(title);
  const summaryHasHighValue = HIGH_VALUE_KEYWORDS.test(summary);

  if (titleHasHighValue) {
    score += 25;
    reasons.push('Hochwertiges Keyword im Titel');
  } else if (titleHasGeneral) {
    score += 12;
    reasons.push('KI-Erwähnung im Titel');
  } else if (summaryHasHighValue) {
    score += 8;
    reasons.push('Hochwertiges Keyword in Summary');
  } else {
    // Weder im Titel noch Summary ein gutes Keyword → wahrscheinlich randständig
    score -= 10;
  }

  // ── Faktor 3: Frische-Bonus ──────────────────────────────────
  let ageHours = 24;  // Default, falls kein Datum parsebar
  try {
    const pubDate = new Date(pubDateStr);
    if (!isNaN(pubDate.getTime())) {
      ageHours = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
    }
  } catch (e) { /* Default behalten */ }

  if (ageHours <= 6) {
    score += 20;
    reasons.push('Sehr frisch (<6h)');
  } else if (ageHours <= 12) {
    score += 14;
    reasons.push('Frisch (<12h)');
  } else if (ageHours <= 24) {
    score += 8;
    reasons.push('Aktuell (<24h)');
  } else if (ageHours <= MAX_AGE_HOURS) {
    score += 2;
  } else {
    score -= 15;
    reasons.push(`Alt (${Math.round(ageHours)}h)`);
  }

  // ── Faktor 4: Längen-Qualität ────────────────────────────────
  const summaryLen = summary.length;
  if (summaryLen < 30) {
    score -= 8;  // Zu wenig Inhalt
    reasons.push('Sehr kurze Summary');
  } else if (summaryLen > 80 && summaryLen < 300) {
    score += 6;  // Substantielle Summary
  } else if (summaryLen > 500) {
    score -= 3;  // Evtl. Marketing-Wall-of-Text
  }

  // ── Faktor 5: Klickbait-Penalty ──────────────────────────────
  if (CLICKBAIT_PATTERNS.test(title) || CLICKBAIT_PATTERNS.test(summary)) {
    score -= 25;
    reasons.push('Klickbait-Verdacht');
  }

  // ── Faktor 6: URL-Qualität (tiefer Artikel > Startseite) ─────
  if (link) {
    const pathSegments = link.split('/').filter(s => s.length > 0).length;
    if (pathSegments >= 4) {
      score += 4;  // Tiefer Artikel-Link
    } else if (pathSegments <= 2) {
      score -= 5;  // Startseite / Kategorie
    }
  }

  // Score auf 0 unten begrenzen (negative Scores vermeiden)
  score = Math.max(0, Math.round(score));

  return {
    ...item,
    _score: score,
    _scoreReasons: reasons.join('; '),
    _ageHours: Math.round(ageHours),
  };
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════

const allItems = $input.all().map(i => i.json);

console.log(`[Score&Rank] Input: ${allItems.length} deduplizierte Items`);

// 1. Alle Items scorren
const scored = allItems.map(scoreItem);

// 2. Nach Score sortieren (absteigend)
scored.sort((a, b) => b._score - a._score);

// 3. Top N nehmen
const topItems = scored.slice(0, TOP_N);

// 4. Logging
console.log(`[Score&Rank] Output: Top ${topItems.length} Items (von ${scored.length})`);
console.log('[Score&Rank] Top 5:');
topItems.slice(0, 5).forEach((item, i) => {
  console.log(`  ${i + 1}. [${item._score}P] ${item.source} — "${(item.title || '').substring(0, 60)}..." (${item._scoreReasons})`);
});
console.log('[Score&Rank] Durchschnittsscore Top:', Math.round(topItems.reduce((s, i) => s + i._score, 0) / topItems.length));
console.log('[Score&Rank] Niedrigster Score im Cutoff:', topItems[topItems.length - 1]?._score || 'n/a');

// 5. Cleanup-Felder vor der Rückgabe entfernen (außer für Debug)
// Wir behalten _score für eventuelles n8n-UI-Debugging, aber entfernen die internen Gründe
const cleanOutput = topItems.map(item => ({
  json: {
    title: item.title,
    link: item.link,
    source: item.source,
    pubDate: item.pubDate,
    summary: item.summary,
    languageOrig: item.languageOrig || 'en',
    origin: item.origin || 'rss',
    _score: item._score,
  }
}));

return cleanOutput;

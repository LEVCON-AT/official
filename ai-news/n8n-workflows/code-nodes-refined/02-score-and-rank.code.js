// ═══════════════════════════════════════════════════════════════
//  SCORE & RANK (REFINED v4 — DE/EN ONLY + SOURCE DIVERSITY)
//
//  NEU in v4:
//   - 10 DE + 10 EN, keine INTL (entlastet Qwen, klarerer Fokus)
//   - Max-Items-per-Source-Cap: max 2 Items pro Quelle pro Sprache
//     (verhindert Heise-Dominanz im DE-Bucket, sorgt für Diversität)
//   - Keine INTL-Umverteilungs-Logik mehr nötig
//   - Total: 20 Items (statt 30 in v3)
//
//  Beibehalten aus v3:
//   - 6-Faktor-Scoring (Source, Keywords, Frische, Länge, Klickbait, URL)
//   - Semantic Dedup (Jaccard >60% → höchstes Score gewinnt)
//   - Min-Score-Threshold (ruhiger Tag = weniger Items)
//   - Score-Distribution-Logging
//
//  Node-Typ: Code (n8n)
//  Position: nach "Dedupe by URL", vor "Build Ollama Request"
// ═══════════════════════════════════════════════════════════════

// ── KONFIGURATION ──────────────────────────────────────────────
const QUOTA_DE           = 10;    // Top 10 deutsche Items
const QUOTA_EN           = 10;    // Top 10 englische Items
const TOTAL_QUOTA        = QUOTA_DE + QUOTA_EN;  // 20

const MAX_ITEMS_PER_SOURCE = 2;   // Max Items pro Quelle pro Sprache
                                  // (verhindert dass Heise 8 von 10 DE-Slots belegt)

const MAX_AGE_HOURS       = 48;   // Items älter als X Std. werden bestraft
const MIN_SCORE_THRESHOLD = 20;   // Min Score für Top-N (ruhiger Tag)
const DEDUP_SIMILARITY    = 0.60; // Jaccard-Threshold für Titel-Dedup
// ─────────────────────────────────────────────────────────────────

// ── 1. QUELLEN-GEWICHTUNG ──────────────────────────────────────
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
  // Mittel (0.7)
  'MarkTechPost': 0.7,
  'Towards Data Science': 0.7,
  'The Information': 0.7,
  // Niedrig (0.5)
  'Mixed.de': 0.5,
  'AInauten': 0.5,
  'Netzwelt': 0.5,
  'KI-Campus': 0.5,
};

// ── 2. KEYWORD-KATEGORIEN ──────────────────────────────────────
const HIGH_VALUE_KEYWORDS = /\b(LLM|GPT|Claude|Gemini|Llama|transformer|diffusion|multimodal|AGI|MoE|RLHF|alignment|EU AI Act|AI Act|regulation|OpenAI|Anthropic|Google AI|Mistral|DeepSeek|Qwen|Nvidia|multimodal)\b/i;
const GENERAL_KI_KEYWORDS = /\b(AI|KI|ML|neural|machine learning|deep learning|generative|model|chatbot|inference|training)\b/i;

// ── 3. KLICKBAIT / SPAM-PATTERNS ───────────────────────────────
const CLICKBAIT_PATTERNS = /\b(you won't believe|shocking|amazing|incredible|mind-blowing|\d+ (best|top|amazing) (ai|tools)|click here|read more|sponsored|advertisement)\b/i;

// ═══════════════════════════════════════════════════════════════
//  SCORING-FUNKTION (unverändert aus v3)
// ═══════════════════════════════════════════════════════════════

function scoreItem(item) {
  const title = (item.title || '').trim();
  const summary = (item.summary || '').trim();
  const source = item.source || 'Unknown';
  const pubDateStr = item.pubDate || '';
  const link = item.link || '';

  let score = 0;
  const reasons = [];

  // Faktor 1: Quellen-Gewichtung (max 40)
  const sourceWeight = SOURCE_WEIGHTS[source] !== undefined ? SOURCE_WEIGHTS[source] : 0.5;
  score += sourceWeight * 40;
  if (sourceWeight >= 1.0) reasons.push(`Top-Quelle (${source})`);
  else if (sourceWeight < 0.6) reasons.push(`Schwache Quelle (${source})`);

  // Faktor 2: Keyword-Qualität (max 25)
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
    score -= 10;
  }

  // Faktor 3: Frische-Bonus (max 20)
  let ageHours = 24;
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

  // Faktor 4: Längen-Qualität (±6)
  const summaryLen = summary.length;
  if (summaryLen < 30) {
    score -= 8;
    reasons.push('Sehr kurze Summary');
  } else if (summaryLen > 80 && summaryLen < 300) {
    score += 6;
    reasons.push('Substantielle Summary');
  } else if (summaryLen > 500) {
    score -= 3;
  }

  // Faktor 5: Klickbait-Penalty (−25)
  if (CLICKBAIT_PATTERNS.test(title) || CLICKBAIT_PATTERNS.test(summary)) {
    score -= 25;
    reasons.push('Klickbait-Verdacht');
  }

  // Faktor 6: URL-Tiefe (±4)
  if (link) {
    const pathSegments = link.split('/').filter(s => s.length > 0).length;
    if (pathSegments >= 4) score += 4;
    else if (pathSegments <= 2) score -= 5;
  }

  score = Math.max(0, Math.round(score));

  return {
    ...item,
    _score: score,
    _scoreReasons: reasons.join('; '),
    _ageHours: Math.round(ageHours),
  };
}

// ═══════════════════════════════════════════════════════════════
//  SEMANTIC DEDUP (unverändert aus v3)
// ═══════════════════════════════════════════════════════════════

function tokenize(text) {
  return new Set(
    (text || '')
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 2)
  );
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

function semanticDedup(scoredItems) {
  const kept = [];
  const keptTokens = [];

  for (const item of scoredItems) {
    const itemTokens = tokenize(item.title);
    let isDuplicate = false;

    for (let i = 0; i < kept.length; i++) {
      const sim = jaccardSimilarity(itemTokens, keptTokens[i]);
      if (sim >= DEDUP_SIMILARITY) {
        isDuplicate = true;
        if (item._score > kept[i]._score) {
          kept[i] = item;
          keptTokens[i] = itemTokens;
        }
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(item);
      keptTokens.push(itemTokens);
    }
  }

  return kept;
}

// ═══════════════════════════════════════════════════════════════
//  NEU in v4: APPLY SOURCE DIVERSITY CAP
// ═══════════════════════════════════════════════════════════════
//  Limitiert wieviele Items eine einzelne Quelle beisteuern darf.
//  Verhindert dass Heise ( prolifisch) 8 von 10 DE-Slots belegt.
//  Nach Score sortiert — die besten Items einer Quelle gewinnen.
// ═══════════════════════════════════════════════════════════════

function applySourceDiversity(items, maxPerSource) {
  const sourceCounts = {};
  const result = [];

  for (const item of items) {
    const src = item.source || 'Unknown';
    if ((sourceCounts[src] || 0) < maxPerSource) {
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      result.push(item);
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════

const allItems = $input.all().map(i => i.json);
console.log(`[Score&Rank] Input: ${allItems.length} deduplizierte Items`);

// 1. Alle Items scorren
const scored = allItems.map(scoreItem);

// 2. Nach Score sortieren (für Semantic Dedup)
scored.sort((a, b) => b._score - a._score);

// 3. Semantic Dedup (vor Bucketing — Story-Dominanz verhindern)
const beforeDedupCount = scored.length;
const dedupedScored = semanticDedup(scored);
console.log(`[Score&Rank] Semantic Dedup: ${beforeDedupCount} → ${dedupedScored.length} (entfernt ${beforeDedupCount - dedupedScored.length} ähnliche)`);

// 4. In DE und EN Buckets spalten (INTL wird ignoriert)
const deBucket = dedupedScored.filter(i => (i.languageOrig || 'en').toLowerCase() === 'de');
const enBucket = dedupedScored.filter(i => (i.languageOrig || 'en').toLowerCase() === 'en');

console.log(`[Quota] Bucket-Größen: DE=${deBucket.length}, EN=${enBucket.length}`);

// 5. Beide Buckets nach Score sortieren (absteigend)
deBucket.sort((a, b) => b._score - a._score);
enBucket.sort((a, b) => b._score - a._score);

// 6. NEU: Source-Diversity-Cap anwenden (max 2 pro Quelle)
//    Behält die Reihenfolge nach Score bei, limitiert aber pro Quelle.
const deDiverse = applySourceDiversity(deBucket, MAX_ITEMS_PER_SOURCE);
const enDiverse = applySourceDiversity(enBucket, MAX_ITEMS_PER_SOURCE);

console.log(`[Quota] Nach Source-Diversity (max ${MAX_ITEMS_PER_SOURCE}/Quelle): DE=${deDiverse.length}, EN=${enDiverse.length}`);

// 7. Top N aus jedem Bucket nehmen
let deSelected = deDiverse.slice(0, QUOTA_DE);
let enSelected = enDiverse.slice(0, QUOTA_EN);

// 8. Umverteilung freier Slots (DE ↔ EN)
//    Wenn ein Bucket weniger als sein Quota hat, wird der andere Bucket
//    aufgefüllt — ABER mit Source-Diversity-Cap, damit nicht eine Quelle
//    alle freien Slots bekommt.
const deFree = QUOTA_DE - deSelected.length;
const enFree = QUOTA_EN - enSelected.length;

if (deFree > 0) {
  // DE hat freie Slots → EN mit zusätzlichen Items auffüllen
  // Nimmt die nächsten EN-Items (nach Source-Diversity-Cap) die noch nicht
  // selected sind. Respektiert MAX_ITEMS_PER_SOURCE auch bei Umverteilung.
  const enExtraPool = enDiverse.filter(i => !enSelected.includes(i));
  const enExtra = enExtraPool.slice(0, deFree);
  enSelected = enSelected.concat(enExtra);
  console.log(`[Quota] DE-Freiplätze (${deFree}) → EN: +${enExtra.length}`);
}

if (enFree > 0) {
  const deExtraPool = deDiverse.filter(i => !deSelected.includes(i));
  const deExtra = deExtraPool.slice(0, enFree);
  deSelected = deSelected.concat(deExtra);
  console.log(`[Quota] EN-Freiplätze (${enFree}) → DE: +${deExtra.length}`);
}

// 9. Kombinieren
let finalItems = [...deSelected, ...enSelected];

// 10. Minimum-Score-Threshold (ruhiger News-Tag)
const lowScoreCount = finalItems.filter(i => i._score < MIN_SCORE_THRESHOLD).length;
if (lowScoreCount === finalItems.length && finalItems.length > 10) {
  const keepDe = Math.min(5, deSelected.length);
  const keepEn = Math.min(5, enSelected.length);
  finalItems = [...deSelected.slice(0, keepDe), ...enSelected.slice(0, keepEn)];
  console.log(`[Score&Rank] ⚠️ Ruhiger News-Tag: Alle unter ${MIN_SCORE_THRESHOLD}P → reduziere auf ${finalItems.length} Items`);
}

// 11. Score-Distribution-Logging
const scores = finalItems.map(i => i._score);
const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, i) => s + i, 0) / scores.length) : 0;
const allScores = scored.map(i => i._score).sort((a, b) => b - a);

console.log(`\n═══ SCORE DISTRIBUTION REPORT ═══`);
console.log(`Input (nach URL-Dedup):     ${allItems.length}`);
console.log(`Nach Semantic Dedup:        ${dedupedScored.length}`);
console.log(`Bucket-Größen (verfügbar):  DE=${deBucket.length}, EN=${enBucket.length}`);
console.log(`Nach Source-Diversity:      DE=${deDiverse.length} (max ${MAX_ITEMS_PER_SOURCE}/Quelle), EN=${enDiverse.length}`);
console.log(`Final Output:               ${finalItems.length} (Quota: DE=${deSelected.length}, EN=${enSelected.length})`);
console.log(`Avg Score (Final):          ${avgScore}`);
console.log(`Highest Score:              ${scores[0] || 0}`);
console.log(`Lowest Score (Final):       ${scores[scores.length - 1] || 0}`);
console.log(`════════════════════════════════\n`);

// 12. Sprach- + Source-Verteilung im Final-Output
const langCounts = {};
const sourceCounts = {};
const sourceByLang = {};  // source → { de: N, en: N }
finalItems.forEach(i => {
  const lang = i.languageOrig || 'en';
  langCounts[lang] = (langCounts[lang] || 0) + 1;
  sourceCounts[i.source] = (sourceCounts[i.source] || 0) + 1;
  if (!sourceByLang[i.source]) sourceByLang[i.source] = { de: 0, en: 0 };
  sourceByLang[i.source][lang] = (sourceByLang[i.source][lang] || 0) + 1;
});
console.log('[Score&Rank] Sprach-Verteilung im Output:');
Object.entries(langCounts).sort((a, b) => b[1] - a[1]).forEach(([lang, count]) => {
  console.log(`  ${lang.toUpperCase()}: ${count}x`);
});
console.log('[Score&Rank] Source-Verteilung im Output (Cap ist pro Sprache, daher kann eine Quelle in DE+EN je 2x vorkommen):');
Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).forEach(([src, count]) => {
  const split = sourceByLang[src];
  console.log(`  ${src}: ${count}x (DE: ${split.de}, EN: ${split.en})`);
});

console.log('\n[Score&Rank] Top 3 pro Bucket:');
console.log('  DE:', deSelected.slice(0, 3).map(i => `[${i._score}P] ${i.source} — "${(i.title||'').substring(0,50)}..."`).join('\n      '));
console.log('  EN:', enSelected.slice(0, 3).map(i => `[${i._score}P] ${i.source} — "${(i.title||'').substring(0,50)}..."`).join('\n      '));

// 13. Cleanup-Felder vor Rückgabe
const cleanOutput = finalItems.map(item => ({
  json: {
    title: item.title,
    link: item.link,
    source: item.source,
    pubDate: item.pubDate,
    summary: item.summary,
    languageOrig: item.languageOrig || 'en',
    _score: item._score,
    _scoreReasons: item._scoreReasons,
    _bucket: item.languageOrig === 'de' ? 'de' : 'en',
  }
}));

return cleanOutput;

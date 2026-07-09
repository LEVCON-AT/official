// ═══════════════════════════════════════════════════════════════
//  SCORE & RANK (REFINED v3 — LANGUAGE QUOTA)
//
//  NEU in v3: 3-Bucket Language-Quota-System
//   - DE-Bucket: Top 10 deutsche Items (höchster Score)
//   - EN-Bucket: Top 10 englische Items (höchster Score)
//   - INTL-Bucket: Top 10 internationale Items (zh, ja, fr, es, etc.)
//   - Total: 30 Items mit garantierter Sprach-Verteilung
//   - Umverteilung bei knappen Buckets: DE → EN → INTL Priorität
//
//  Beibehalten aus v2:
//   - Semantic Dedup (Jaccard >60% → höchstes Score gewinnt)
//   - Minimum-Score-Threshold (ruhiger Tag = weniger Items)
//   - Score-Distribution-Logging
//
//  Node-Typ: Code (n8n)
//  Position: nach "Dedupe by URL", vor "Build Ollama Request"
// ═══════════════════════════════════════════════════════════════

// ── KONFIGURATION ──────────────────────────────────────────────
const QUOTA_DE    = 10;    // Top 10 deutsche Items
const QUOTA_EN    = 10;    // Top 10 englische Items
const QUOTA_INTL  = 10;    // Top 10 internationale Items (zh, ja, fr, es, ...)
const TOTAL_QUOTA = QUOTA_DE + QUOTA_EN + QUOTA_INTL;  // 30

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
//  SCORING-FUNKTION (unverändert aus v2)
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
//  SEMANTIC DEDUP (unverändert aus v2)
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
        // Falls neues Item höheres Score, ersetze
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
//  NEU in v3: LANGUAGE-QUOTA BUCKETING
// ═══════════════════════════════════════════════════════════════
//  Spaltet Items in 3 Sprach-Buckets und nimmt aus jedem die
//  Top-N (nach Score). Garantiert Sprach-Verteilung für die
//  österreichische Seite (DE hat Vorrang).
//
//  Buckets:
//    DE:   languageOrig === 'de' (Heise, Golem, Tagesschau, etc.)
//    EN:   languageOrig === 'en' (MIT, Ars Technica, Anthropic, etc.)
//    INTL: alles andere (zh, ja, fr, es, it, pt, ...)
//
//  Umverteilung bei knappen Buckets:
//    Freie Slots gehen an: DE → EN → INTL (heimische Priorität)
// ═══════════════════════════════════════════════════════════════

function bucketByLanguage(items) {
  const de = [];
  const en = [];
  const intl = [];

  for (const item of items) {
    const lang = (item.languageOrig || 'en').toLowerCase();
    if (lang === 'de') de.push(item);
    else if (lang === 'en') en.push(item);
    else intl.push(item);  // zh, ja, fr, es, it, pt, etc.
  }

  return { de, en, intl };
}

function applyLanguageQuota(scoredItems) {
  // 1. In Buckets spalten
  const { de: deBucket, en: enBucket, intl: intlBucket } = bucketByLanguage(scoredItems);

  console.log(`[Quota] Bucket-Größen: DE=${deBucket.length}, EN=${enBucket.length}, INTL=${intlBucket.length}`);

  // 2. Jeden Bucket nach Score sortieren (absteigend)
  deBucket.sort((a, b) => b._score - a._score);
  enBucket.sort((a, b) => b._score - a._score);
  intlBucket.sort((a, b) => b._score - a._score);

  // 3. Quota aus jedem Bucket nehmen
  let deSelected = deBucket.slice(0, QUOTA_DE);
  let enSelected = enBucket.slice(0, QUOTA_EN);
  let intlSelected = intlBucket.slice(0, QUOTA_INTL);

  // 4. Umverteilung freier Slots
  //    Priorität: DE → EN → INTL (österreichische Site)
  let deRemaining = deBucket.length - deSelected.length;  // wieviele DE noch verfügbar?
  let enRemaining = enBucket.length - enSelected.length;
  let intlRemaining = intlBucket.length - intlSelected.length;

  let deFree = QUOTA_DE - deSelected.length;    // freie DE-Slots
  let enFree = QUOTA_EN - enSelected.length;
  let intlFree = QUOTA_INTL - intlSelected.length;

  // Phase 1: Freie INTL-Slots → an DE, dann EN
  if (intlFree > 0) {
    // Erst DE auffüllen
    const deFill = Math.min(intlFree, deRemaining);
    if (deFill > 0) {
      deSelected = deSelected.concat(deBucket.slice(QUOTA_DE, QUOTA_DE + deFill));
      deRemaining -= deFill;
      intlFree -= deFill;
      console.log(`[Quota] INTL-Freiplätze → DE: +${deFill} (DE jetzt ${deSelected.length})`);
    }
    // Rest an EN
    const enFill = Math.min(intlFree, enRemaining);
    if (enFill > 0) {
      enSelected = enSelected.concat(enBucket.slice(QUOTA_EN, QUOTA_EN + enFill));
      enRemaining -= enFill;
      intlFree -= enFill;
      console.log(`[Quota] INTL-Freiplätze → EN: +${enFill} (EN jetzt ${enSelected.length})`);
    }
  }

  // Phase 2: Freie DE-Slots → an EN, dann INTL
  deFree = QUOTA_DE - deSelected.length;
  if (deFree > 0) {
    const enFill = Math.min(deFree, enRemaining);
    if (enFill > 0) {
      enSelected = enSelected.concat(enBucket.slice(QUOTA_EN, QUOTA_EN + enFill));
      enRemaining -= enFill;
      deFree -= enFill;
      console.log(`[Quota] DE-Freiplätze → EN: +${enFill} (EN jetzt ${enSelected.length})`);
    }
    const intlFill = Math.min(deFree, intlRemaining);
    if (intlFill > 0) {
      intlSelected = intlSelected.concat(intlBucket.slice(QUOTA_INTL, QUOTA_INTL + intlFill));
      intlRemaining -= intlFill;
      deFree -= intlFill;
      console.log(`[Quota] DE-Freiplätze → INTL: +${intlFill} (INTL jetzt ${intlSelected.length})`);
    }
  }

  // Phase 3: Freie EN-Slots → an DE, dann INTL
  enFree = QUOTA_EN - enSelected.length;
  if (enFree > 0) {
    const deFill = Math.min(enFree, deRemaining);
    if (deFill > 0) {
      deSelected = deSelected.concat(deBucket.slice(QUOTA_DE, QUOTA_DE + deFill));
      deRemaining -= deFill;
      enFree -= deFill;
      console.log(`[Quota] EN-Freiplätze → DE: +${deFill} (DE jetzt ${deSelected.length})`);
    }
    const intlFill = Math.min(enFree, intlRemaining);
    if (intlFill > 0) {
      intlSelected = intlSelected.concat(intlBucket.slice(QUOTA_INTL, QUOTA_INTL + intlFill));
      intlRemaining -= intlFill;
      enFree -= intlFill;
      console.log(`[Quota] EN-Freiplätze → INTL: +${intlFill} (INTL jetzt ${intlSelected.length})`);
    }
  }

  return { deSelected, enSelected, intlSelected };
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

// 4. NEU: Language-Quota Bucketing
const { deSelected, enSelected, intlSelected } = applyLanguageQuota(dedupedScored);

// 5. Kombinieren: DE + EN + INTL (für LLM)
let finalItems = [...deSelected, ...enSelected, ...intlSelected];

// 6. Minimum-Score-Threshold (ruhiger News-Tag)
const lowScoreCount = finalItems.filter(i => i._score < MIN_SCORE_THRESHOLD).length;
if (lowScoreCount === finalItems.length && finalItems.length > 10) {
  // Alle unter Threshold → nur Top 15 senden (aus jedem Bucket proportional)
  const keepDe = Math.min(5, deSelected.length);
  const keepEn = Math.min(5, enSelected.length);
  const keepIntl = Math.min(5, intlSelected.length);
  finalItems = [...deSelected.slice(0, keepDe), ...enSelected.slice(0, keepEn), ...intlSelected.slice(0, keepIntl)];
  console.log(`[Score&Rank] ⚠️ Ruhiger News-Tag: Alle unter ${MIN_SCORE_THRESHOLD}P → reduziere auf ${finalItems.length} Items`);
}

// 7. Score-Distribution-Logging
const scores = finalItems.map(i => i._score);
const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, i) => s + i, 0) / scores.length) : 0;
const allScores = scored.map(i => i._score).sort((a, b) => b - a);

console.log(`\n═══ SCORE DISTRIBUTION REPORT ═══`);
console.log(`Input (nach URL-Dedup):     ${allItems.length}`);
console.log(`Nach Semantic Dedup:        ${dedupedScored.length}`);
console.log(`Bucket-Größen (verfügbar):  DE=${dedupedScored.filter(i=>i.languageOrig==='de').length}, EN=${dedupedScored.filter(i=>i.languageOrig==='en').length}, INTL=${dedupedScored.filter(i=>!['de','en'].includes(i.languageOrig)).length}`);
console.log(`Final Output:               ${finalItems.length} (Quota: DE=${deSelected.length}, EN=${enSelected.length}, INTL=${intlSelected.length})`);
console.log(`Avg Score (Final):          ${avgScore}`);
console.log(`Highest Score:              ${scores[0] || 0}`);
console.log(`Lowest Score (Final):       ${scores[scores.length - 1] || 0}`);
console.log(`Items unter Threshold:      ${lowScoreCount}/${finalItems.length} (< ${MIN_SCORE_THRESHOLD}P)`);
console.log(`════════════════════════════════\n`);

// 8. Sprach-Verteilung im Final-Output
const langCounts = {};
finalItems.forEach(i => {
  const lang = i.languageOrig || 'en';
  langCounts[lang] = (langCounts[lang] || 0) + 1;
});
console.log('[Score&Rank] Sprach-Verteilung im Output:');
Object.entries(langCounts).sort((a, b) => b[1] - a[1]).forEach(([lang, count]) => {
  console.log(`  ${lang.toUpperCase()}: ${count}x`);
});

console.log('\n[Score&Rank] Top 3 pro Bucket:');
console.log('  DE:', deSelected.slice(0, 3).map(i => `[${i._score}P] ${i.source} — "${(i.title||'').substring(0,50)}..."`).join('\n      '));
console.log('  EN:', enSelected.slice(0, 3).map(i => `[${i._score}P] ${i.source} — "${(i.title||'').substring(0,50)}..."`).join('\n      '));
console.log('  INTL:', intlSelected.slice(0, 3).map(i => `[${i._score}P] ${i.source} — "${(i.title||'').substring(0,50)}..."`).join('\n      '));

// 9. Cleanup-Felder vor Rückgabe
//    _bucket wird für Build Ollama Request benötigt (annotiert Prompt)
const cleanOutput = finalItems.map(item => ({
  json: {
    title: item.title,
    link: item.link,
    source: item.source,
    pubDate: item.pubDate,
    summary: item.summary,
    languageOrig: item.languageOrig || 'en',
    origin: item.origin || 'rss',
    _score: item._score,
    _scoreReasons: item._scoreReasons,
    _bucket: item.languageOrig === 'de' ? 'de' : (item.languageOrig === 'en' ? 'en' : 'intl'),
  }
}));

return cleanOutput;

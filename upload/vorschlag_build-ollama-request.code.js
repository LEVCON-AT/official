// ═══════════════════════════════════════════════════════════════
//  BUILD OLLAMA REQUEST (AKTUALISIERT)
//  Erwartet Input vom "Score & Rank"-Node (statt slice(0,20)).
//  Baut den qwen3.5:2b-Request mit optimierten Parametern.
//
//  Änderung vs. alte Version:
//  - topItems kommt jetzt von Score&Rank-Node (sortiert, beste zuerst)
//  - Score wird in User-Prompt integriert (LLM sieht Ranking)
//  - Prompt vereinfacht: LLM muss nur noch "beste 10 aus 15" wählen,
//    nicht selbst aus 100 Items kuratieren
// ═══════════════════════════════════════════════════════════════

const allItems = $input.all();

const newsItems = allItems.map(function(i) {
  return {
    title: i.json.title || '',
    link: i.json.link || '',
    source: i.json.source || '',
    pubDate: i.json.pubDate || '',
    summary: i.json.summary || '',
    languageOrig: i.json.languageOrig || 'en',
    score: i.json._score || 0
  };
});

// Score&Rank hat schon sortiert — aber zur Sicherheit nochmal nach Score sortieren
newsItems.sort((a, b) => b.score - a.score);

// Top 15 nehmen (Score&Rank liefert schon 15, aber falls mehr durchkommen)
const topItems = newsItems.slice(0, 15);

const systemPrompt = `You are an expert AI news curator for Levcon.ai, a Vienna-based AI consulting firm.

Your task: Select the 10 most relevant and impactful AI news items from today's international sources. The items are ALREADY pre-ranked by a relevance score — higher score = more relevant.

Relevant topics (in priority order):
- AI/ML research and breakthroughs (including LLMs, SLMs, multimodal AI)
- AI business and industry developments (investments, products, partnerships)
- AI regulation and policy (EU AI Act, global regulation)
- AI tools and applications (productivity, automation, dev tools)
- AI society and ethics (impact, risks, education)

Selection criteria:
1. Impact: Will this change how businesses use AI?
2. Novelty: Is this genuinely new, not a rehash?
3. Diversity: Mix of research, business, regulation, tools
4. International: Balance DE, EN, ZH, JA, FR perspectives

For the daily summary, write ANALYTICALLY — not just "X happened":
- Identify the overarching theme of the day
- Explain WHY these stories matter together
- Give the reader a reason to click and read more

Summary tone: Professional, insightful, concise. Like a McKinsey briefing, not a press release.

Return JSON:
{
  "summaryDe": "Analytische Zusammenfassung auf Deutsch (3-5 Sätze, interesseweckend)",
  "summaryEn": "Analytical summary in English (3-5 sentences, engaging)",
  "items": [
    {
      "headline": "Original headline (original language)",
      "descriptionDe": "Deutsche Zusammenfassung (1-2 Sätze)",
      "descriptionEn": "English summary (1-2 sentences)",
      "source": "Publisher name (e.g. 'Heise', 'MIT Tech Review')",
      "sourceUrl": "Full URL to original article",
      "thumbnailUrl": "Thumbnail URL or null",
      "languageOrig": "de|en|zh|ja|fr",
      "category": "research|business|regulation|tools|society"
    }
  ]
}

IMPORTANT: Return ONLY the JSON object. No markdown, no code blocks, no explanations.`;

// User-Prompt mit Score-Annotation (LLM sieht das Ranking)
const userPrompt = `Today's collected AI news items (pre-ranked by relevance score, highest first):

${JSON.stringify(topItems.map(i => ({
  score: i.score,
  title: i.title,
  link: i.link,
  source: i.source,
  language: i.languageOrig,
  summary: i.summary.substring(0, 200)
})), null, 2)}

Select the 10 BEST items from this list. Prefer items with higher scores, but use your judgment for diversity and impact. Write German + english summaries for each.`;

const requestBody = {
  model: "qwen3.5:2b",
  stream: false,
  options: {
    temperature: 0.3,
    num_predict: 4096,
    num_ctx: 32768,
    enable_thinking: false
  },
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  "think": false
};

const response = await this.helpers.httpRequest({
  method: 'POST',
  url: 'http://127.0.0.1:11434/api/chat',
  headers: { 'Content-Type': 'application/json' },
  body: requestBody,
  json: true,
  timeout: 600000
});

return [{ json: response }];

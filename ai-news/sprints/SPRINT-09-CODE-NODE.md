# Sprint 9 — Code-Node "Build Ollama Request" (Updated)

**Zweck:** Diesen Code in den n8n Code-Node "Build Ollama Request" kopieren.
Ersetzt den bisherigen Code vollständig.

---

## Vollständiger Code

```javascript
const allItems = $input.all();

const newsItems = allItems.map(function(i) {
  return {
    title: i.json.title || '',
    link: i.json.link || '',
    source: i.json.source || '',
    pubDate: i.json.pubDate || '',
    summary: i.json.summary || ''
  };
});

// Top 20 Items an LLM senden (LLM wählt beste 10 aus)
const topItems = newsItems.slice(0, 20);

const systemPrompt = "You are an expert AI news curator for Levcon.ai, a Vienna-based AI consulting firm.\n\nYour task: Select the 10 most relevant and impactful AI news items from today's international sources.\n\nRelevant topics (in priority order):\n- AI/ML research and breakthroughs (including LLMs, SLMs, multimodal AI)\n- AI business and industry developments (investments, products, partnerships)\n- AI regulation and policy (EU AI Act, global regulation)\n- AI tools and applications (productivity, automation, dev tools)\n- AI society and ethics (impact, risks, education)\n\nSelection criteria:\n1. Impact: Will this change how businesses use AI?\n2. Novelty: Is this genuinely new, not a rehash?\n3. Diversity: Mix of research, business, regulation, tools\n4. International: Balance DE, EN, ZH, JA, FR perspectives\n\nFor the daily summary, write ANALYTICALLY — not just \"X happened\":\n- Identify the overarching theme of the day\n- Explain WHY these stories matter together\n- Give the reader a reason to click and read more\n\nSummary tone: Professional, insightful, concise. Like a McKinsey briefing, not a press release.\n\nReturn JSON:\n{\n  \"summaryDe\": \"Analytische Zusammenfassung auf Deutsch (3-5 Sätze, interesseweckend)\",\n  \"summaryEn\": \"Analytical summary in English (3-5 sentences, engaging)\",\n  \"items\": [\n    {\n      \"headline\": \"Original headline (original language)\",\n      \"descriptionDe\": \"Deutsche Zusammenfassung (1-2 Sätze)\",\n      \"descriptionEn\": \"English summary (1-2 sentences)\",\n      \"source\": \"Publisher name (e.g. 'Heise', 'MIT Tech Review')\",\n      \"sourceUrl\": \"Full URL to original article\",\n      \"thumbnailUrl\": \"Thumbnail URL or null\",\n      \"languageOrig\": \"de|en|zh|ja|fr\",\n      \"category\": \"research|business|regulation|tools|society\"\n    }\n  ]\n}\n\nIMPORTANT: Return ONLY the JSON object. No markdown, no code blocks, no explanations.";

const userPrompt = "Today collected AI news items (JSON array):\n" + JSON.stringify(topItems, null, 2);

const requestBody = {
  model: "qwen3.5:2b",
  stream: false,
  options: {
    temperature: 0.3,
    num_predict: 4096
  },
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]
};

// HTTP Request mit n8n-eigenem Helper
const response = await this.helpers.httpRequest({
  method: 'POST',
  url: 'http://127.0.0.1:11434/api/chat',
  headers: { 'Content-Type': 'application/json' },
  body: requestBody,
  json: true,
  timeout: 300000
});

return [{ json: response }];
```

---

## Was sich geändert hat

| Parameter | Vorher (Sprint 5) | Nachher (Sprint 9) |
|---|---|---|
| Modell | `qwen2.5:1.5b` | `qwen3.5:2b` |
| `num_predict` | 3000 | 4096 |
| Input Items | `slice(0, 7)` | `slice(0, 20)` |
| Ausgabe Items | 5-7 | 10 |
| Prompt | Generisch ("Select top 5-10") | Analytisch ("McKinsey briefing", SLMs, Impact, Novelty) |
| Kategorien | Keine | `research|business|regulation|tools|society` |
| Sprache | Keine `languageOrig` | `de|en|zh|ja|fr` |
| Timeout | 300s | 300s (unverändert) |

---

## Erwartete Performance

- Prompt: ~1200 Tokens (20 Items) → ~25 Sekunden
- Generation: ~3500 Tokens (10 Items + 2 Summaries) → ~350 Sekunden
- **Total: ~5-6 Minuten** (akzeptabel für 06:00 Uhr Cron)

## RAM-Erwartung

- Qwen3.5 2B: ~1.8 GB RAM
- VPS gesamt: ~3.3 GB von 3.8 GB
- Swap: ~500 MB Puffer

# Sprint 10 — Code-Node: SearXNG Multi-Search

**Anleitung:** Ersetze den einzelnen SearXNG HTTP-Request Node durch diesen Code-Node.

---

## Vollständiger Code

```javascript
// SearXNG Multi-Search — 6 parallele Queries in DE, EN, ZH, FR
// Ersetzt den einzelnen SearXNG HTTP-Request Node

const QUERIES = [
  { query: 'KI künstliche Intelligenz news heute', lang: 'de' },
  { query: 'artificial intelligence AI news today', lang: 'en' },
  { query: 'LLM breakthrough research', lang: 'en' },
  { query: 'AI regulation policy EU', lang: 'en' },
  { query: '人工智能新闻', lang: 'zh' },
  { query: 'intelligence artificielle actualités', lang: 'fr' }
];

const fetchPromises = QUERIES.map(async (q) => {
  try {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: 'http://127.0.0.1:8888/search',
      qs: {
        q: q.query,
        format: 'json',
        categories: 'news,it',
        time_range: 'day',
        results_on_page: '15'
      },
      timeout: 30000,
      retry: 2
    });

    const results = response.results || [];

    return results.map(r => {
      let source = 'Unknown';
      let url = r.url || '';

      try {
        if (url) {
          const urlObj = new URL(url);
          const host = urlObj.hostname.replace(/^www\./, '');
          const map = {
            'heise.de': 'Heise',
            'golem.de': 'Golem',
            'tagesschau.de': 'Tagesschau',
            'sueddeutsche.de': 'Süddeutsche Zeitung',
            'technologyreview.com': 'MIT Tech Review',
            'arstechnica.com': 'Ars Technica',
            'theverge.com': 'The Verge',
            'techcrunch.com': 'TechCrunch',
            'venturebeat.com': 'VentureBeat',
            'wired.com': 'Wired',
            'nature.com': 'Nature',
            'openai.com': 'OpenAI',
            'huggingface.co': 'Hugging Face',
            'zdnet.de': 'ZDNet',
            'derstandard.at': 'Der Standard',
            'syncedreview.com': 'Synced',
            'pandaily.com': 'Pandaily',
            'technode.com': 'TechNode',
            'marktechpost.com': 'MarkTechPost'
          };
          source = map[host] || host;
        }
      } catch (e) {
        if (url) {
          const match = url.match(/^https?:\/\/([^\/]+)/);
          if (match) source = match[1].replace('www.', '');
        }
      }

      return {
        title: r.title || '',
        link: url,
        source: source,
        pubDate: r.pubDate || new Date().toISOString(),
        summary: r.content || '',
        languageOrig: q.lang,
        origin: 'search'
      };
    });
  } catch (error) {
    console.log(`SearXNG error for query "${q.query}": ${error.message}`);
    return [];
  }
});

const results = await Promise.all(fetchPromises);
const allItems = results.flat();

console.log(`SearXNG: ${allItems.length} items from ${QUERIES.length} queries`);

return allItems.map(item => ({ json: item }));
```

---

## Was dieser Code macht

1. **6 parallele SearXNG Queries** (DE, EN×3, ZH, FR)
2. **Publisher-Namen** aus URL extrahieren (Map mit bekannten Domains)
3. **languageOrig** setzen basierend auf Query-Sprache
4. **Error-Handling** pro Query
5. **Retry** (2 Versuche pro Query)

## Erwartete Results

- 6 Queries × ~15 Results = ~90 Roh-Items
- Nach Dedup mit RSS: ~10-20 zusätzliche unique Items

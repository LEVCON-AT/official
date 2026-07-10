// ═══════════════════════════════════════════════════════════════
//  FETCH ALL RSS FEEDS (REFINED v2)
//
//  Verfeinerungen vs. Vorschlag v1:
//   1. Max-Items-per-Feed-Cap: Ein Feed darf max. MAX_ITEMS_PER_FEED
//      Items beisteuern (sortiert nach pubDate, neueste zuerst).
//      Verhindert, dass ein prolifischer Feed (z.B. arXiv) dominierst.
//   2. Promise.allSettled statt Promise.all: Ein abgestürzter Feed
//      killt nie den gesamten Run (self-healing).
//   3. Sanity-Report erweitert um Per-Feed-Item-Count.
//   4. Heise-URL korrigiert (Atom statt RDF).
//
//  Node-Typ: Code (n8n)
//  Position im Workflow: nach Schedule Trigger, vor "Dedupe by URL"
// ═══════════════════════════════════════════════════════════════

// ── KONFIGURATION ──────────────────────────────────────────────
const MAX_ITEMS_PER_FEED = 30;   // Cap pro Feed nach Keyword-Filter
const FETCH_TIMEOUT_MS   = 30000;
const FETCH_RETRIES      = 2;
// ─────────────────────────────────────────────────────────────────

const RSS_FEEDS = [
  // 🇩🇪 Deutsch (10)
  { url: 'https://www.heise.de/rss/heise-atom.xml', source: 'Heise', lang: 'de' },
  { url: 'https://rss.golem.de/rss.php?feed=RSS2.0', source: 'Golem', lang: 'de' },
  { url: 'https://www.tagesschau.de/xml/rss2', source: 'Tagesschau', lang: 'de' },
  { url: 'https://rss.sueddeutsche.de/rss/wissen', source: 'Süddeutsche Zeitung', lang: 'de' },
  { url: 'https://mixed.de/feed/', source: 'Mixed.de', lang: 'de' },
  { url: 'https://ainauten.com/feed/', source: 'AInauten', lang: 'de' },
  { url: 'https://www.derstandard.at/rss/web/tech', source: 'Der Standard', lang: 'de' },
  { url: 'https://www.zdnet.de/feed/', source: 'ZDNet', lang: 'de' },
  { url: 'https://www.netzwelt.de/feed/', source: 'Netzwelt', lang: 'de' },
  { url: 'https://www.ki-campus.org/rss', source: 'KI-Campus', lang: 'de' },

  // 🇺🇸 Englisch (12)
  { url: 'https://www.technologyreview.com/feed/', source: 'MIT Tech Review', lang: 'en' },
  { url: 'https://feeds.arstechnica.com/arstechnica/features', source: 'Ars Technica', lang: 'en' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'The Verge', lang: 'en' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch', lang: 'en' },
  { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat', lang: 'en' },
  { url: 'https://www.marktechpost.com/feed/', source: 'MarkTechPost', lang: 'en' },
  { url: 'https://huggingface.co/blog/feed.xml', source: 'Hugging Face', lang: 'en' },
  { url: 'https://www.anthropic.com/news/rss.xml', source: 'Anthropic', lang: 'en' },
  { url: 'https://openai.com/blog/rss.xml', source: 'OpenAI', lang: 'en' },
  { url: 'https://www.wired.com/feed/tag/ai/latest/rss', source: 'Wired', lang: 'en' },
  { url: 'https://towardsdatascience.com/feed', source: 'Towards Data Science', lang: 'en' },
  { url: 'https://www.theinformation.com/feed', source: 'The Information', lang: 'en' },

  // 🇨🇳 Chinesisch (4)
  { url: 'https://syncedreview.com/feed/', source: 'Synced', lang: 'zh' },
  { url: 'https://www.caixinglobal.com/feed/', source: 'Caixin Global', lang: 'zh' },
  { url: 'https://pandaily.com/feed/', source: 'Pandaily', lang: 'zh' },
  { url: 'https://technode.com/feed/', source: 'TechNode', lang: 'zh' },

  // 🇯🇵 Japanisch (3)
  { url: 'https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml', source: 'ITmedia', lang: 'ja' },
  { url: 'https://tech.nikkeibp.co.jp/rss/index.rdf', source: 'Nikkei Tech', lang: 'ja' },
  { url: 'https://ascii.jp/rss.xml', source: 'ASCII.jp', lang: 'ja' },

  // 🇫🇷 Französisch (3)
  { url: 'https://www.usine-digitale.fr/rss/index.xml', source: "L'Usine Digitale", lang: 'fr' },
  { url: 'https://www.journaldunet.com/rss/', source: 'Le Journal du Net', lang: 'fr' },
  { url: 'https://actuia.com/feed/', source: 'ActuIA', lang: 'fr' },

  // 🌐 Research (3)
  { url: 'https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=10', source: 'arXiv cs.AI', lang: 'en' },
  { url: 'https://export.arxiv.org/api/query?search_query=cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=10', source: 'arXiv cs.LG', lang: 'en' },
  { url: 'https://export.arxiv.org/api/query?search_query=cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=10', source: 'arXiv cs.CL', lang: 'en' }
];

// ── KEYWORDS ───────────────────────────────────────────────────
// Breite KI-Keyword-Liste (gleiche wie v1 — bewährt)
const AI_KEYWORDS = /\b(AI|KI|ML|LLM|GPT|Claude|neural|model|machine learning|deep learning|generative|transformer|Anthropic|OpenAI|Gemini|Llama|SLM|diffusion|chatbot|AGI|multimodal|embedding|RAG|agent|reasoning|inference|training|fine-tuning|quantization|guardrail|alignment|safety|hallucination|prompt|tokenization|MoE|mixture of experts|instruction tuning|RLHF|DPO|LoRA|benchmark|MMLU|HellaSwag|HumanEval|GSM8K|Eleuther|Hugging Face|LangChain|LlamaIndex|vLLM|Ollama|llama\.cpp|GGUF|GGML|ONNX|TensorRT|CUDA|TPU|GPU|Nvidia|AMD|Intel|Groq|Cerebras|SambaNova|together\.ai|replicate|modal|runpod|vast\.ai|Lambda Labs|CoreWeave|Google AI|Mistral AI|Cohere|AI21|Stability AI|Midjourney|DALL-E|Stable Diffusion|SDXL|FLUX|Ideogram|Leonardo AI|Runway ML|Pika Labs|Suno AI|ElevenLabs|Descript|HeyGen|Synthesia|DeepBrain|AI Act|EU AI Act|regulation|governance|compliance|ethics|bias|fairness|transparency|explainability|XAI|responsible AI|trustworthy AI|AI safety|existential risk|alignment problem|AGI safety|AI alignment|interpretability|mechanistic interpretability|probing|activation steering|representation engineering|circuit analysis|induction heads|attention heads|transformer circuits|sparse autoencoders|dictionary learning|superposition|monosemanticity|polysemanticity|scaling laws|Chinchilla|compute-optimal|emergent abilities|grokking|double descent|scaling hypothesis|bitter lesson|DeepSeek|Qwen)\b/i;

// ── HELPER ─────────────────────────────────────────────────────
function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// HTML-Entities dekodieren: &#8217; → ', &amp; → &, &quot; → ", etc.
// RSS-Feeds enthalten oft HTML-Entities die wir sauber als UTF-8 wollen.
function decodeHtmlEntities(s) {
  if (!s) return s;
  return s
    // Numeric entities: &#8217; → '
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    // Hex entities: &#x2019; → '
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Named entities (common ones)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&lsquo;/g, '\'')
    .replace(/&rsquo;/g, '\'')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"');
}

function parseDate(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

// ═══════════════════════════════════════════════════════════════
//  FEED FETCHER (mit Max-Items-per-Feed-Cap)
// ═══════════════════════════════════════════════════════════════

const feedStats = [];

const fetchPromises = RSS_FEEDS.map(async (feed) => {
  const startTime = Date.now();
  try {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: feed.url,
      timeout: FETCH_TIMEOUT_MS,
      retry: FETCH_RETRIES,
      encoding: 'utf-8',        // NEU: UTF-8 erzwingen (verhindert Latin-1 Fehlinterpretation)
      responseType: 'text'      // NEU: immer als Text zurückgeben (nicht auto-detect JSON)
    });

    const xml = typeof response === 'string' ? response : String(response);
    const items = [];

    const itemRegex = /<(?:item|entry)[\s\S]*?>([\s\S]*?)<\/(?:item|entry)>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];

      const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const title = titleM ? decodeHtmlEntities(stripTags(stripCdata(titleM[1]))) : '';

      const linkM = block.match(/<link[^>]*?href="([^"]+)"[^>]*\/?\s*>/) || block.match(/<link[^>]*>([\s\S]*?)<\/link>/);
      const link = linkM ? (linkM[1] || '').trim() : '';

      const pubM = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || block.match(/<published[^>]*>([\s\S]*?)<\/published>/) || block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/);
      const pubDate = pubM ? pubM[1].trim() : new Date().toISOString();

      const descM = block.match(/<description[^>]*>([\s\S]*?)<\/description>/) || block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
      let summary = descM ? decodeHtmlEntities(stripTags(stripCdata(descM[1]))) : '';
      if (summary.length > 300) summary = summary.substring(0, 297) + '...';

      if (title && link && (AI_KEYWORDS.test(title) || AI_KEYWORDS.test(summary))) {
        items.push({
          title,
          link,
          source: feed.source,
          pubDate,
          _pubDateMs: parseDate(pubDate),  // für Sortierung
          summary,
          languageOrig: feed.lang,
          origin: 'rss'
        });
      }
    }

    // ── NEU: Max-Items-per-Feed-Cap ───────────────────────────
    // Sortiere nach pubDate (neueste zuerst) und cappe auf MAX_ITEMS_PER_FEED.
    // Verhindert, dass ein prolifischer Feed (z.B. arXiv mit 10 Items,
    // oder ein Blog mit 50 Posts) die Kuration dominiert.
    items.sort((a, b) => (b._pubDateMs || 0) - (a._pubDateMs || 0));
    const cappedItems = items.slice(0, MAX_ITEMS_PER_FEED);

    const duration = Date.now() - startTime;
    feedStats.push({
      source: feed.source,
      rawCount: (xml.match(/<(?:item|entry)[\s>]/g) || []).length,
      kiCountBeforeCap: items.length,
      kiCountAfterCap: cappedItems.length,
      durationMs: duration,
      status: 'ok'
    });
    return cappedItems;

  } catch (error) {
    const duration = Date.now() - startTime;
    feedStats.push({
      source: feed.source,
      rawCount: 0,
      kiCountBeforeCap: 0,
      kiCountAfterCap: 0,
      durationMs: duration,
      status: 'error',
      error: error.message
    });
    console.log(`⚠️ Feed-Fehler ${feed.source}: ${error.message}`);
    return [];  // Dead Feed killt nicht den Run
  }
});

// ── Promise.allSettled: self-healing, ein Crash killt nie alles ──
const settled = await Promise.allSettled(fetchPromises);
const results = settled
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);
const rejected = settled.filter(r => r.status === 'rejected');

const allItems = results.flat();

// _pubDateMs Cleanup (wird in Score&Rank nicht benötigt)
allItems.forEach(item => { delete item._pubDateMs; });

// ── SANITY-REPORT (erweitert) ──────────────────────────────────
const okFeeds = feedStats.filter(f => f.status === 'ok');
const deadFeeds = feedStats.filter(f => f.status === 'error');
const emptyFeeds = feedStats.filter(f => f.status === 'ok' && f.kiCountAfterCap === 0);
const cappedFeeds = feedStats.filter(f => f.status === 'ok' && f.kiCountBeforeCap > f.kiCountAfterCap);

console.log(`\n═══ RSS SANITY REPORT ═══`);
console.log(`Total feeds:         ${RSS_FEEDS.length}`);
console.log(`✅ OK & KI-Items:     ${okFeeds.filter(f => f.kiCountAfterCap > 0).length}`);
console.log(`⚠️  OK aber 0 Items:  ${emptyFeeds.length} → ${emptyFeeds.map(f => f.source).join(', ') || 'keine'}`);
console.log(`❌ Fehler/Dead:       ${deadFeeds.length} → ${deadFeeds.map(f => `${f.source} (${f.error})`).join(', ') || 'keine'}`);
console.log(`✂️  Gecapped:          ${cappedFeeds.length} → ${cappedFeeds.map(f => `${f.source} (${f.kiCountBeforeCap}→${f.kiCountAfterCap})`).join(', ') || 'keine'}`);
console.log(`📊 Total KI-Items:    ${allItems.length} (nach Cap)`);
console.log(`⏱️  Langsamster Feed:  ${Math.max(...feedStats.map(f => f.durationMs))}ms`);
console.log(`══════════════════════════\n`);

return allItems.map(item => ({ json: item }));

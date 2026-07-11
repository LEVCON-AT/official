// ═══════════════════════════════════════════════════════════════
//  FETCH ALL RSS FEEDS (v4 — Encoding-Fix FINAL)
//
//  Root-Cause:
//   this.helpers.httpRequest dekodiert Body intern immer als UTF-8.
//   Fix: helpers.request() (request-Library) mit encoding:null liefert
//        echten Buffer → korrektes Charset-Erkennung & Dekodierung.
//   Fallback: native fetch() mit AbortController (NICHT AbortSignal.timeout,
//             das erst ab Node 17.3 existiert).
//
//  Node-Typ: Code (n8n)
//  Position im Workflow: nach Schedule Trigger, vor "Dedupe by URL"
// ═══════════════════════════════════════════════════════════════

// ── KONFIGURATION ──────────────────────────────────────────────
const MAX_ITEMS_PER_FEED = 30;
const FETCH_TIMEOUT_MS   = 30000;
const FETCH_RETRIES      = 2;
// ──────────────────────────────────────────────────────────────

// n8n-Kontext einmal oben sichern — helper-Funktionen haben kein 'this'
const _helpers = this.helpers;

const RSS_FEEDS = [
  // 🇩🇪 Deutsch (10)
  { url: 'https://www.heise.de/rss/heise-atom.xml',              source: 'Heise',               lang: 'de' },
  { url: 'https://rss.golem.de/rss.php?feed=RSS2.0',             source: 'Golem',               lang: 'de' },
  { url: 'https://www.tagesschau.de/xml/rss2',                   source: 'Tagesschau',          lang: 'de' },
  { url: 'https://rss.sueddeutsche.de/rss/wissen',               source: 'Süddeutsche Zeitung', lang: 'de' },
  { url: 'https://mixed.de/feed/',                               source: 'Mixed.de',            lang: 'de' },
  { url: 'https://ainauten.com/feed/',                           source: 'AInauten',            lang: 'de' },
  { url: 'https://www.derstandard.at/rss/web/tech',              source: 'Der Standard',        lang: 'de' },
  { url: 'https://www.zdnet.de/feed/',                           source: 'ZDNet',               lang: 'de' },
  { url: 'https://www.netzwelt.de/feed/',                        source: 'Netzwelt',            lang: 'de' },
  { url: 'https://www.ki-campus.org/rss',                        source: 'KI-Campus',           lang: 'de' },

  // 🇺🇸 Englisch (12)
  { url: 'https://www.technologyreview.com/feed/',               source: 'MIT Tech Review',     lang: 'en' },
  { url: 'https://feeds.arstechnica.com/arstechnica/features',   source: 'Ars Technica',        lang: 'en' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'The Verge', lang: 'en' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch', lang: 'en' },
  { url: 'https://venturebeat.com/category/ai/feed/',            source: 'VentureBeat',         lang: 'en' },
  { url: 'https://www.marktechpost.com/feed/',                   source: 'MarkTechPost',        lang: 'en' },
  { url: 'https://huggingface.co/blog/feed.xml',                 source: 'Hugging Face',        lang: 'en' },
  { url: 'https://www.anthropic.com/news/rss.xml',               source: 'Anthropic',           lang: 'en' },
  { url: 'https://openai.com/blog/rss.xml',                      source: 'OpenAI',              lang: 'en' },
  { url: 'https://www.wired.com/feed/tag/ai/latest/rss',         source: 'Wired',               lang: 'en' },
  { url: 'https://towardsdatascience.com/feed',                  source: 'Towards Data Science', lang: 'en' },
  { url: 'https://www.theinformation.com/feed',                  source: 'The Information',     lang: 'en' },

  // 🇨🇳 Chinesisch (4)
  { url: 'https://syncedreview.com/feed/',                       source: 'Synced',              lang: 'zh' },
  { url: 'https://www.caixinglobal.com/feed/',                   source: 'Caixin Global',       lang: 'zh' },
  { url: 'https://pandaily.com/feed/',                           source: 'Pandaily',            lang: 'zh' },
  { url: 'https://technode.com/feed/',                           source: 'TechNode',            lang: 'zh' },

  // 🇯🇵 Japanisch (3)
  { url: 'https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml',   source: 'ITmedia',             lang: 'ja' },
  { url: 'https://tech.nikkeibp.co.jp/rss/index.rdf',           source: 'Nikkei Tech',         lang: 'ja' },
  { url: 'https://ascii.jp/rss.xml',                             source: 'ASCII.jp',            lang: 'ja' },

  // 🇫🇷 Französisch (3)
  { url: 'https://www.usine-digitale.fr/rss/index.xml',          source: "L'Usine Digitale",    lang: 'fr' },
  { url: 'https://www.journaldunet.com/rss/',                    source: 'Le Journal du Net',   lang: 'fr' },
  { url: 'https://actuia.com/feed/',                             source: 'ActuIA',              lang: 'fr' },

  // 🌐 Research (3)
  { url: 'https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=10', source: 'arXiv cs.AI', lang: 'en' },
  { url: 'https://export.arxiv.org/api/query?search_query=cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=10', source: 'arXiv cs.LG', lang: 'en' },
  { url: 'https://export.arxiv.org/api/query?search_query=cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=10', source: 'arXiv cs.CL', lang: 'en' }
];

// ── KEYWORDS ───────────────────────────────────────────────────
const AI_KEYWORDS = /\b(AI|KI|ML|LLM|GPT|Claude|neural|model|machine learning|deep learning|generative|transformer|Anthropic|OpenAI|Gemini|Llama|SLM|diffusion|chatbot|AGI|multimodal|embedding|RAG|agent|reasoning|inference|training|fine-tuning|quantization|guardrail|alignment|safety|hallucination|prompt|tokenization|MoE|mixture of experts|instruction tuning|RLHF|DPO|LoRA|benchmark|MMLU|HellaSwag|HumanEval|GSM8K|Eleuther|Hugging Face|LangChain|LlamaIndex|vLLM|Ollama|llama\.cpp|GGUF|GGML|ONNX|TensorRT|CUDA|TPU|GPU|Nvidia|AMD|Intel|Groq|Cerebras|SambaNova|together\.ai|replicate|modal|runpod|vast\.ai|Lambda Labs|CoreWeave|Google AI|Mistral AI|Cohere|AI21|Stability AI|Midjourney|DALL-E|Stable Diffusion|SDXL|FLUX|Ideogram|Leonardo AI|Runway ML|Pika Labs|Suno AI|ElevenLabs|Descript|HeyGen|Synthesia|DeepBrain|AI Act|EU AI Act|regulation|governance|compliance|ethics|bias|fairness|transparency|explainability|XAI|responsible AI|trustworthy AI|AI safety|existential risk|alignment problem|AGI safety|AI alignment|interpretability|mechanistic interpretability|probing|activation steering|representation engineering|circuit analysis|induction heads|attention heads|transformer circuits|sparse autoencoders|dictionary learning|superposition|monosemanticity|polysemanticity|scaling laws|Chinchilla|compute-optimal|emergent abilities|grokking|double descent|scaling hypothesis|bitter lesson|DeepSeek|Qwen)\b/i;

// ── HELPER: Text ───────────────────────────────────────────────
function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}
function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function decodeHtmlEntities(s) {
  if (!s) return s;
  return s
    .replace(/&#(\d+);/g,           (_, n)   => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h)   => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g,   '&').replace(/&lt;/g,    '<').replace(/&gt;/g,    '>')
    .replace(/&quot;/g,  '"').replace(/&apos;/g,  "'").replace(/&nbsp;/g,  ' ')
    .replace(/&copy;/g,  '©').replace(/&reg;/g,   '®').replace(/&trade;/g, '™')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g,'…')
    .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"');
}
function parseDate(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

// ── HELPER: Charset aus Buffer erkennen ────────────────────────
function detectCharset(buffer, headers) {
  // 1. Content-Type Header
  const ct = headers['content-type'] || headers['Content-Type'] || '';
  const ctMatch = /charset=([^;]+)/i.exec(ct);
  if (ctMatch) return ctMatch[1].trim().toLowerCase().replace(/["']/g, '');
  // 2. XML-Deklaration (immer ASCII → latin1-Preview ist safe)
  const preview = buffer.slice(0, 300).toString('latin1');
  const xmlMatch = /<\?xml[^>]*encoding=["']([^"']+)["']/i.exec(preview);
  if (xmlMatch) return xmlMatch[1].trim().toLowerCase();
  // 3. Fallback
  return 'utf-8';
}

// ── CORE: Raw-Bytes-Fetch (zwei Strategien, self-healing) ──────
//
//  Strategie A: _helpers.request() — basiert auf der 'request'-npm-Library.
//               encoding:null gibt dort ECHTEN Buffer zurück (garantiert),
//               unabhängig vom Content-Type. Zuverlässigste Methode in n8n.
//
//  Strategie B: native fetch() mit AbortController.
//               KEIN AbortSignal.timeout() — erst ab Node 17.3!
//               fetch().arrayBuffer() liefert Rohbytes ohne Auto-Dekodierung.
//
async function fetchRawBytes(url, timeoutMs) {

  // ── Strategie A ──────────────────────────────────────────────
  if (typeof _helpers.request === 'function') {
    const resp = await _helpers.request({
      method:                 'GET',
      uri:                    url,       // request-lib nutzt 'uri', nicht 'url'
      encoding:               null,      // ← der entscheidende Parameter: gibt Buffer
      resolveWithFullResponse: true,
      timeout:                timeoutMs,
      gzip:                   true       // automatische gzip-Dekompression
    });
    const buffer = Buffer.isBuffer(resp.body)
      ? resp.body
      : Buffer.from(resp.body);
    return { buffer, headers: resp.headers || {}, strategy: 'request()' };
  }

  // ── Strategie B ──────────────────────────────────────────────
  if (typeof fetch !== 'undefined') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const headers = {};
      resp.headers.forEach((v, k) => { headers[k] = v; });
      return {
        buffer:   Buffer.from(await resp.arrayBuffer()),
        headers,
        strategy: 'fetch()'
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Kein HTTP-Client verfügbar (weder helpers.request noch fetch)');
}

async function fetchWithRetry(url, timeoutMs, retries) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { buffer, headers, strategy } = await fetchRawBytes(url, timeoutMs);
      const charset = detectCharset(buffer, headers);
      const xml     = new TextDecoder(charset, { fatal: false }).decode(buffer);
      return { xml, charset, strategy };
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // 1s, 2s backoff
      }
    }
  }
  throw lastError;
}

// ═══════════════════════════════════════════════════════════════
//  FEED FETCHER
// ═══════════════════════════════════════════════════════════════

const feedStats = [];
let detectedStrategy = null;  // für Report: welche Strategie läuft?

const fetchPromises = RSS_FEEDS.map(async (feed) => {
  const startTime = Date.now();
  try {
    const { xml, charset, strategy } = await fetchWithRetry(feed.url, FETCH_TIMEOUT_MS, FETCH_RETRIES);
    if (!detectedStrategy) detectedStrategy = strategy;

    const items = [];
    const itemRegex = /<(?:item|entry)[\s\S]*?>([\s\S]*?)<\/(?:item|entry)>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];

      const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const title  = titleM ? decodeHtmlEntities(stripTags(stripCdata(titleM[1]))) : '';

      const linkM = block.match(/<link[^>]*?href="([^"]+)"[^>]*\/?\s*>/)
                 || block.match(/<link[^>]*>([\s\S]*?)<\/link>/);
      const link  = linkM ? (linkM[1] || '').trim() : '';

      const pubM = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)
                || block.match(/<published[^>]*>([\s\S]*?)<\/published>/)
                || block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/);
      const pubDate = pubM ? pubM[1].trim() : new Date().toISOString();

      const descM = block.match(/<description[^>]*>([\s\S]*?)<\/description>/)
                 || block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
      let summary = descM ? decodeHtmlEntities(stripTags(stripCdata(descM[1]))) : '';
      if (summary.length > 300) summary = summary.substring(0, 297) + '...';

      if (title && link && (AI_KEYWORDS.test(title) || AI_KEYWORDS.test(summary))) {
        items.push({
          title,
          link,
          source:       feed.source,
          pubDate,
          _pubDateMs:   parseDate(pubDate),
          summary,
          languageOrig: feed.lang,
          origin:       'rss'
        });
      }
    }

    items.sort((a, b) => (b._pubDateMs || 0) - (a._pubDateMs || 0));
    const cappedItems = items.slice(0, MAX_ITEMS_PER_FEED);

    feedStats.push({
      source:           feed.source,
      charset,
      rawCount:         (xml.match(/<(?:item|entry)[\s>]/g) || []).length,
      kiCountBeforeCap: items.length,
      kiCountAfterCap:  cappedItems.length,
      durationMs:       Date.now() - startTime,
      status:           'ok'
    });
    return cappedItems;

  } catch (error) {
    feedStats.push({
      source:           feed.source,
      charset:          null,
      rawCount:         0,
      kiCountBeforeCap: 0,
      kiCountAfterCap:  0,
      durationMs:       Date.now() - startTime,
      status:           'error',
      error:            error.message
    });
    console.log(`⚠️ Feed-Fehler ${feed.source}: ${error.message}`);
    return [];
  }
});

// ── Promise.allSettled: ein Crash killt nie den gesamten Run ───
const settled  = await Promise.allSettled(fetchPromises);
const allItems = settled
  .filter(r => r.status === 'fulfilled')
  .flatMap(r => r.value);

allItems.forEach(item => { delete item._pubDateMs; });

// ── SANITY-REPORT ──────────────────────────────────────────────
const okFeeds     = feedStats.filter(f => f.status === 'ok');
const deadFeeds   = feedStats.filter(f => f.status === 'error');
const emptyFeeds  = feedStats.filter(f => f.status === 'ok' && f.kiCountAfterCap === 0);
const cappedFeeds = feedStats.filter(f => f.status === 'ok' && f.kiCountBeforeCap > f.kiCountAfterCap);
const nonUtf8    = feedStats.filter(f => f.charset && f.charset !== 'utf-8');

console.log(`\n═══ RSS SANITY REPORT ═══`);
console.log(`🔌 HTTP-Strategie:    ${detectedStrategy || '❌ KEINE — alle Feeds fehlgeschlagen'}`);
console.log(`Total feeds:         ${RSS_FEEDS.length}`);
console.log(`✅ OK & KI-Items:     ${okFeeds.filter(f => f.kiCountAfterCap > 0).length}`);
console.log(`⚠️  OK aber 0 Items:  ${emptyFeeds.length} → ${emptyFeeds.map(f => f.source).join(', ') || 'keine'}`);
console.log(`❌ Fehler/Dead:       ${deadFeeds.length} → ${deadFeeds.map(f => `${f.source} (${f.error})`).join(', ') || 'keine'}`);
console.log(`✂️  Gecapped:          ${cappedFeeds.length} → ${cappedFeeds.map(f => `${f.source} (${f.kiCountBeforeCap}→${f.kiCountAfterCap})`).join(', ') || 'keine'}`);
console.log(`🔤 Nicht-UTF-8:       ${nonUtf8.length} → ${nonUtf8.map(f => `${f.source} (${f.charset})`).join(', ') || 'keine'}`);
console.log(`📊 Total KI-Items:    ${allItems.length} (nach Cap)`);
console.log(`⏱️  Langsamster Feed:  ${feedStats.length ? Math.max(...feedStats.map(f => f.durationMs)) : 0}ms`);
console.log(`══════════════════════════\n`);

return allItems.map(item => ({ json: item }));
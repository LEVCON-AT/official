# Sprint 10 — Code-Node: Fetch All RSS Feeds

**Anleitung:** Ersetze alle 8 einzelnen RSS-Fetch-Nodes durch diesen einen Code-Node.

---

## Vollständiger Code

```javascript
// Fetch All RSS Feeds — 35 internationale Quellen parallel
// Ersetzt alle einzelnen HTTP-Request RSS-Nodes

const RSS_FEEDS = [
  // 🇩🇪 Deutsch (10)
  { url: 'https://heise.de/rss/heise.rdf', source: 'Heise', lang: 'de' },
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

const AI_KEYWORDS = /\b(AI|KI|ML|LLM|GPT|Claude|neural|model|machine learning|deep learning|generative|transformer|Anthropic|OpenAI|Gemini|Llama|SLM|diffusion|chatbot|AGI|multimodal|embedding|RAG|agent|reasoning|inference|training|fine-tuning|quantization|guardrail|alignment|safety|hallucination|prompt|tokenization|MoE|mixture of experts|instruction tuning|RLHF|DPO|LoRA|fine-tuning|benchmark|MMLU|HellaSwag|HumanEval|GSM8K|Eleuther|Hugging Face|LangChain|LlamaIndex|vLLM|Ollama|llama\.cpp|GGUF|GGML|ONNX|TensorRT|CUDA|TPU|GPU|Nvidia|AMD|Intel|Groq|Cerebras|SambaNova|together\.ai|replicate|modal|runpod|vast\.ai|Lambda Labs|CoreWeave|Papers with Code|Semantic Scholar|Google Scholar|arXiv|Hugging Face Spaces|Gradio|Streamlit|Chainlit|OpenAI API|Anthropic API|Google AI|Mistral AI|Cohere|AI21|Stability AI|Midjourney|DALL-E|Stable Diffusion|SDXL|FLUX|Ideogram|Leonardo AI|Runway ML|Pika Labs|Suno AI|ElevenLabs|Descript|HeyGen|Synthesia|DeepBrain|AI Act|EU AI Act|regulation|governance|compliance|ethics|bias|fairness|transparency|explainability|XAI|responsible AI|trustworthy AI|AI safety|existential risk|alignment problem|AGI safety|AI alignment|interpretability|mechanistic interpretability|probing|activation steering|representation engineering|circuit analysis|induction heads|attention heads|transformer circuits|sparse autoencoders|dictionary learning|superposition|monosemanticity|polysemanticity|scaling laws|Chinchilla|compute-optimal|emergent abilities|grokking|double descent|scaling hypothesis|bitter lesson)\b/i;

function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Fetch all feeds in parallel
const fetchPromises = RSS_FEEDS.map(async (feed) => {
  try {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: feed.url,
      timeout: 30000,
      retry: 2
    });

    const xml = typeof response === 'string' ? response : JSON.stringify(response);
    const items = [];

    // Parse RSS/RDF/Atom items
    const itemRegex = /<(?:item|entry)[\s\S]*?>([\s\S]*?)<\/(?:item|entry)>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];

      const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const title = titleM ? stripTags(stripCdata(titleM[1])) : '';

      const linkM = block.match(/<link[^>]*?href="([^"]+)"[^>]*\/?\s*>/) || block.match(/<link[^>]*>([\s\S]*?)<\/link>/);
      const link = linkM ? (linkM[1] || '').trim() : '';

      const pubM = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || block.match(/<published[^>]*>([\s\S]*?)<\/published>/) || block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/);
      const pubDate = pubM ? pubM[1].trim() : new Date().toISOString();

      const descM = block.match(/<description[^>]*>([\s\S]*?)<\/description>/) || block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
      let summary = descM ? stripTags(stripCdata(descM[1])) : '';
      if (summary.length > 300) summary = summary.substring(0, 297) + '...';

      // Filter: KI/AI relevance
      if (title && link && (AI_KEYWORDS.test(title) || AI_KEYWORDS.test(summary))) {
        items.push({
          title,
          link,
          source: feed.source,
          pubDate,
          summary,
          languageOrig: feed.lang,
          origin: 'rss'
        });
      }
    }

    return items;
  } catch (error) {
    console.log(`Error fetching ${feed.source}: ${error.message}`);
    return [];
  }
});

const results = await Promise.all(fetchPromises);
const allItems = results.flat();

console.log(`Fetched ${allItems.length} KI-relevant items from ${RSS_FEEDS.length} feeds`);

return allItems.map(item => ({ json: item }));
```

---

## Was dieser Code macht

1. **35 RSS Feeds** parallel laden (Promise.all)
2. **XML parsen** (RSS/RDF/Atom Format)
3. **KI-Relevanz-Filter** (erweiterte Keyword-Liste mit 100+ Terms)
4. **Publisher-Namen** korrekt setzen (z.B. "Heise", "MIT Tech Review", "Synced")
5. **languageOrig** setzen (de, en, zh, ja, fr)
6. **Error-Handling** pro Feed (ein fehlgeschlagener Feed stopt nicht die anderen)
7. **Retry** (2 Versuche pro Feed)

## Erwartete Results

- 35 Feeds × ~10 Items = ~350 Roh-Items
- Nach KI-Filter: ~50-100 relevante Items
- Nach Dedup: ~30-50 unique Items
- LLM wählt Top 10-12 aus

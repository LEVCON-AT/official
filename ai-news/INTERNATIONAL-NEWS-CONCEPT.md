# International AI News — Konzept & Architektur

**Status:** Draft v1.0
**Erstellt:** 2025-07-08
**Owner:** Enric-Bernard Sep-Albi (Levcon.ai)

---

## 1. Vision

Levcon.ai wird die **umfassendste tägliche KI-News-Kuration** im DACH-Raum — kuratiert aus internationalen Quellen (DE, EN, ZH, JA, FR), zusammengefasst durch ein lokales LLM, präsentiert in minimalistischem Levcon-Design.

**Kernprinzipien:**
- **Ultra-international:** Quellen aus 5 Sprachräumen
- **Lokal & DSGVO-konform:** LLM läuft auf eigenem VPS
- **Minimalistisch:** Kompakte Listen, Aufklapp-Logik, keine Bilderrausch
- **Mehrsprachig:** DE + EN Zusammenfassungen, Original-Quelle verlinkt
- **Skalierbar:** Newsletter mit Sprach- und Frequenz-Präferenzen

---

## 2. Quellen-Strategie (RSS + SearXNG)

### 2.1 RSS-Feeds (primär, stabil)

#### 🇩🇪 Deutsch (DACH & EU-Recht)
| Quelle | RSS-URL | Fokus |
|---|---|---|
| Heise KI | https://heise.de/rss/heise.rdf | IT, KI, Security |
| Golem KI | https://rss.golem.de/rss.php?feed=RSS2.0 | IT, KI |
| Tagesschau | https://www.tagesschau.de/xml/rss2 | Allgemein, auch KI |
| Mixed.de | https://mixed.de/feed/ | KI-spezifisch |
| AInauten | https://ainauten.com/feed/ | KI-spezifisch |
| BTC-ECHO KI | https://www.btc-echo.de/feed/ | KI + Crypto |

#### 🇺🇸 Englisch (Global & Silicon Valley)
| Quelle | RSS-URL | Fokus |
|---|---|---|
| MIT Tech Review | https://www.technologyreview.com/feed/ | KI, Tech |
| Ars Technica | https://feeds.arstechnica.com/arstechnica/features | Tech, KI |
| The Verge AI | https://www.theverge.com/rss/ai-artificial-intelligence/index.xml | KI |
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ | KI-Startups |
| VentureBeat AI | https://venturebeat.com/category/ai/feed/ | KI-Business |
| MarkTechPost | https://www.marktechpost.com/feed/ | KI-Forschung |
| Hugging Face Blog | https://huggingface.co/blog/feed.xml | Open-Source KI |
| Anthropic Blog | https://www.anthropic.com/news/rss.xml | KI-Anbieter |
| OpenAI Blog | https://openai.com/blog/rss.xml | KI-Anbieter |

#### 🇨🇳 Chinesisch (Asiatischer Markt & Big Tech)
| Quelle | RSS-URL | Fokus |
|---|---|---|
| Synced (机器之心) | https://syncedreview.com/feed/ | KI-Forschung (EN-Zusammenfassung) |
| Caixin Global | https://www.caixinglobal.com/feed/ | Tech & Wirtschaft |

#### 🇯🇵 Japanisch (Robotik & Hardware)
| Quelle | RSS-URL | Fokus |
|---|---|---|
| ITmedia AI | https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml | Tech, KI |

#### 🇫🇷 Französisch (Europäische Forschung)
| Quelle | RSS-URL | Fokus |
|---|---|---|
| L'Usine Digitale | https://www.usine-digitale.fr/rss/index.xml | Tech, KI |

### 2.2 SearXNG Web-Suche (ergänzend)

SearXNG sucht mit gezielten Queries in mehreren Sprachen:

| Sprache | Query | Zeitfilter |
|---|---|---|
| DE | `KI künstliche Intelligenz news heute` | 24h |
| EN | `artificial intelligence news today` | 24h |
| EN | `LLM breakthrough research` | 24h |
| EN | `AI regulation policy EU` | 24h |
| ZH | `人工智能新闻` (via SearXNG) | 24h |
| FR | `intelligence artificielle actualités` | 24h |

**n8n Implementierung:** Parallele HTTP-Requests für jede Query, dann Merge + Dedup.

### 2.3 arXiv (Forschungs-Papers, optional)

| Kategorie | API-URL |
|---|---|
| AI (cs.AI) | https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=10 |
| ML (cs.LG) | https://export.arxiv.org/api/query?search_query=cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=10 |
| CL (cs.CL) | https://export.arxiv.org/api/query?search_query=cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=10 |

---

## 3. LLM-Strategie

### 3.1 Modell-Auswahl

| Modell | RAM | Context | Speed | Qualität | Empfehlung |
|---|---|---|---|---|---|
| Qwen 2.5 1.5B (aktuell) | ~1.2 GB | 32K | ~15 tok/s | OK, aber limitiert | Current |
| **Qwen 2.5 3B** | ~2.5 GB | 32K | ~8 tok/s | Sehr gut, multilingual | ⭐ Empfohlen |
| Qwen 2.5 7B | ~4.5 GB | 32K | ~3 tok/s | Excellent | RAM-kritisch |

**Empfehlung: Qwen 2.5 3B**
- Besseres Context-Fenster für mehr Items
- Multilingual (DE, EN, ZH, JA, FR)
- Mit 2.6 GB freiem RAM machbar (Swap als Puffer)
- Token-Limit: `num_predict: 4096` (für 10+ Items mit DE+EN Summaries)

### 3.2 Prompt-Engineering

**System Prompt (analytisch, interesseweckend):**

```
You are an expert AI news curator for Levcon.ai, a Vienna-based AI consulting firm.

Your task: Select the 10 most relevant and impactful AI news items from today's international sources.

Selection criteria (in priority order):
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

IMPORTANT: Return ONLY the JSON object. No markdown, no code blocks.
```

### 3.3 Workflow-Aufteilung (mehrstufig)

Falls Qwen 2.5 3B zu langsam für alle Items in einem Durchgang:

**Stufe 1: Scraping (parallel)**
- DE RSS + DE SearXNG → ~15 Items
- EN RSS + EN SearXNG → ~20 Items
- INT RSS (ZH/JA/FR) + INT SearXNG → ~10 Items

**Stufe 2: Pre-Filter (Code-Node, kein LLM)**
- Keyword-Filter: Nur Items mit KI-Bezug behalten
- Dedup nach URL
- Top 20 behalten (sortiert nach Relevanz-Score)

**Stufe 3: LLM Curation (Ollama)**
- Input: 20 gefilterte Items
- Output: Top 10 + DE/EN Summary
- Fallback bei Token-Limit: Nur Top 7

---

## 4. Frontend-Konzept (Website)

### 4.1 News-Panel Layout (unverändert minimalistisch)

```
┌──────────────────────────────────────────────┐
│ AI NEWS                                       │
│ What moves the AI world today — curated.     │
├──────────────────────────────────────────────┤
│ TODAY · 8. Juli 2026                         │
│                                               │
│ ┌─ Summary (analytisch, italic) ───────────┐ │
│ │ Heute dominiert die Verschärfung der KI-  │ │
│ │ Regulierung in China, während Mistral AI  │ │
│ │ mit Leanstral 1.5 die Forschungswelt      │ │
│ │ überrascht. Apple positioniert sich mit   │ │
│ │ Trust Insights erstmals aktiv im...       │ │
│ └──────────────────────────────────────────┘ │
│                                               │
│ ▸ Apple: KI-Framework "Trust Insights"...    │
│   HEISE · 12:31                    [↗]      │
│                                               │
│ ▸ Leanstral 1.5: Formale Beweise für 4$...  │
│   HEISE · 12:16                    [↗]      │
│   [▾ Aufklappen für Zusammenfassung]         │
│   ┌──────┐ Mistral AI veröffentlicht...      │
│   │ Thumb│ Weiterlesen →                     │
│   └──────┘                                   │
│                                               │
│ ▸ China verschärft KI-Regeln...              │
│   HEISE · 12:09                    [↗]      │
│                                               │
│ ▸ [🇨🇳 ZH] 中国加强AI监管...                  │
│   SYNCED · 10:00                   [↗]      │
│   [▾ Aufklappen für deutsche Übersetzung]    │
│                                               │
│ ── ARCHIV ──────────────────────────────     │
│ ── NEWSLETTER ───────────────────────────    │
└──────────────────────────────────────────────┘
```

### 4.2 Internationale News-Anzeige

**Prinzip:** Alle News in einer einheitlichen Liste, unabhängig der Originalsprache.

| Element | Anzeige |
|---|---|
| **Headline** | Original-Headline (nicht übersetzt) |
| **Flagge/Sprache** | Klein vor der Headline: 🇨🇳 / 🇯🇵 / 🇫🇷 |
| **Zusammenfassung** | DE + EN (von LLM generiert) |
| **Original-Link** | Externer Link (rel="noopener noreferrer nofollow") |
| **Thumbnail** | 60×60px, lazy-loaded (optional, nur wenn verfügbar) |
| **Aufklappen** | Wie bisher: Chevron → Summary + Thumbnail + Weiterlesen |

**Keine separaten Reiter** — alle News in einer Liste, sortiert nach Relevanz (LLM entscheidet).

### 4.3 Übersetzungs-Feature (optional, später)

Für nicht-deutschsprachige Originalartikel:

**Option A (empfohlen): LLM-Übersetzung beim Aufklappen**
- Beim Aufklappen zeigt das Item: "Deutsche Zusammenfassung" (bereits vorhanden)
- Zusätzlich Button: "Originalartikel auf Deutsch lesen →"
- Klick öffnet neues Fenster mit Google Translate (`https://translate.google.com/translate?sl=auto&tl=de&u=<URL>`)

**Option B (später): Vollständige Übersetzung**
- LLM übersetzt den kompletten Artikel beim Scraping
- Speicherung in DB
- Aufklappen zeigt übersetzten Volltext
- RAM/CPU-intensiv, nur für Top 3 Items

**Empfehlung:** Option A — leichtgewichtig, kein zusätzlicher LLM-Aufwand, User entscheidet selbst.

### 4.4 Kategorien (optional, später)

Jedes Item bekommt eine Kategorie vom LLM:
- 🔬 Research (Forschung, Papers)
- 💼 Business (Investments, Firmen)
- ⚖️ Regulation (Gesetze, Regulierung)
- 🛠️ Tools (Produkte, Software)
- 🌍 Society (Gesellschaft, Ethik)

Anzeige als kleiner Tag neben der Quelle. Keine Filterung (hält es minimalistisch).

---

## 5. Newsletter-Konzept

### 5.1 Sprach- & Frequenz-Präferenzen

**Subscriber kann wählen:**

| Einstellung | Optionen |
|---|---|
| **Newsletter-Sprache** | DE / EN (bestimmt E-Mail-Sprache) |
| **News-Sprachen** | DE / EN / INT (welche News enthalten sind) |
| **Frequenz** | Daily / Weekly / Monthly |

**Beispiele:**
- User A: DE Newsletter, DE+EN News, Daily → Tägliche deutsche Mail mit DE+EN News
- User B: EN Newsletter, EN+INT News, Weekly → Wöchentliche englische Mail mit EN+ZH/JA/FR News
- User C: DE Newsletter, DE+EN+INT News, Monthly → Monatliche deutsche Mail mit allen News

### 5.2 Frequenz-abhängige Zusammenfassungen

| Frequenz | Zusammenfassung | Items |
|---|---|---|
| **Daily** | Analytische Tageszusammenfassung (3-5 Sätze) | Top 10 des Tages |
| **Weekly** | Wochenrückblick: "Was diese Woche bewegt hat" (5-8 Sätze) | Top 20 der Woche (oder alle) |
| **Monthly** | Monatsdigest: "Der Monat in der KI" (8-12 Sätze) | Top 30 des Monats |

**Implementierung:**
- LLM generiert bei Bedarf eine kontextsensitive Zusammenfassung
- Für Weekly/Monthly: LLM fasst die gespeicherten Daily-Summaries zusammen
-alternativ: LLM kuratiert aus allen Items der Periode neu

### 5.3 Massenversand (Bulk)

**Statt Einzel-Sendung:**
- n8n sammelt alle Subscriber für eine Frequenz
- Gruppiert nach Newsletter-Sprache (DE/EN)
- Sendet in Batches (z.B. 50 pro SMTP-Verbindung)
- BCC für Datenschutz (oder individuelle Personalisierung mit Merge-Tags)

**Besser:** Individueller Versand mit Batch-Optimierung
- n8n iteriert über Subscriber
- Rendert HTML einmal pro Sprache (nicht pro Subscriber)
- Sendet mit persönlichem Abmeldelink
- SMTP-Verbindung wiederverwenden (Keep-Alive)

### 5.4 Newsletter-Betreff

| Frequenz | DE | EN |
|---|---|---|
| Daily | `Deine LEVCON.AI Nachrichten · 8. Juli` | `Your LEVCON.AI News · July 8` |
| Weekly | `Deine LEVCON.AI Wochenübersicht` | `Your LEVCON.AI Weekly Digest` |
| Monthly | `Deine LEVCON.AI Monatübersicht` | `Your LEVCON.AI Monthly Digest` |

### 5.5 Einstellungsseite (Settings Page)

**Neue Route:** `/account` (oder `/einstellungen`)

**Funktionen:**
- Sprache ändern (DE/EN)
- News-Sprachen anpassen (DE/EN/INT)
- Frequenz ändern (Daily/Weekly/Monthly)
- Abonnieren/Abmelden

**Auth:** Token-basiert (wie Confirm/Unsubscribe)
- Subscriber bekommt Link mit Token: `/account?token=<uuid>`
- Link in jeder Newsletter-Mail unten ("Einstellungen ändern")

**DB-Erweiterung:**
```prisma
model NewsletterSubscriber {
  // ... bestehend
  newsLanguages  String   @default("de,en")  // "de,en,int"
}
```

---

## 6. Datenbank-Erweiterungen

### 6.1 AiNewsItem Erweiterung

```prisma
model AiNewsItem {
  // ... bestehend
  category       String?  // "research|business|regulation|tools|society"
  thumbnailUrl   String?  // bereits vorhanden
  languageOrig   String   // bereits vorhanden: "de|en|zh|ja|fr"
}
```

### 6.2 NewsletterSubscriber Erweiterung

```prisma
model NewsletterSubscriber {
  // ... bestehend
  newsLanguages  String   @default("de,en")  // welche News-Sprachen
  // language = Newsletter-Sprache (DE/EN)
  // frequency = daily/weekly/monthly
}
```

---

## 7. n8n Workflow-Architektur (überarbeitet)

### 7.1 Workflow 01: Collect & Curate (Daily 06:00)

```
[Cron 06:00 Vienna]
    │
    ├── [Parallel] DE RSS Feeds (6 Quellen)
    ├── [Parallel] EN RSS Feeds (9 Quellen)
    ├── [Parallel] INT RSS Feeds (4 Quellen: ZH, JA, FR)
    ├── [Parallel] SearXNG DE Search
    ├── [Parallel] SearXNG EN Search
    ├── [Parallel] SearXNG INT Search
    │
    ├── [Code] Normalize + Merge all items
    ├── [Code] Pre-Filter (KI-Keywords) + Dedup
    ├── [Code] Build LLM Request (Top 20 Items)
    ├── [Code] Ollama HTTP (Qwen 2.5 3B)
    ├── [Code] Parse LLM JSON (fehler-tolerant)
    ├── [HTTP] POST to /api/ai-news/internal/ingest
    │
    └── [Parallel]
        ├── [HTTP] Trigger LinkedIn Workflow
        └── [HTTP] Trigger Newsletter Workflow
```

### 7.2 Workflow 03: Newsletter Send (überarbeitet)

```
[Trigger: Webhook oder Cron]
    │
    ├── [Code] Set Frequency (daily/weekly/monthly)
    ├── [HTTP] Fetch News (heute / diese Woche / dieser Monat)
    ├── [HTTP] Fetch Subscribers (nach Frequenz + Sprache)
    │
    ├── [Code] Render Newsletter HTML (pro Sprache: DE/EN)
    │   └── Einmal rendern, mehrfach verwenden
    │
    ├── [Code] Batch Send (SMTP)
    │   ├── For each subscriber:
    │   │   ├── Inject personal unsubscribe link
    │   │   ├── Send via SMTP (keep-alive)
    │   │   └── Update lastSentDate
    │   └── Batch size: 50 (dann SMTP reconnect)
    │
    └── [Code] Summary report (X sent, Y errors)
```

### 7.3 Workflow 04: Cleanup (Daily 03:00, unverändert)

---

## 8. Sprint-Plan

### Sprint 9: Modell-Upgrade & Prompt-Optimierung
- Qwen 2.5 3B auf VPS installieren
- Prompt auf analytisch/interesseweckend umstellen
- num_predict auf 4096 erhöhen
- Test mit 20 Input-Items
- Quality-Vergleich mit Qwen 1.5B

### Sprint 10: Internationale Quellen
- RSS-Feeds erweitern (ZH, JA, FR)
- SearXNG Multi-Query (DE, EN, ZH, FR)
- Pre-Filter Code-Node (KI-Keywords)
- arXiv API (optional)
- Quelle-Feld korrigieren (Domain → Publisher-Name)

### Sprint 11: Frontend International News
- Flagge/Sprache vor Headline
- Thumbnail-Anzeige beim Aufklappen
- Google Translate Link für nicht-DE Artikel
- Kategorie-Tags (optional)

### Sprint 12: Newsletter Bulk & Präferenzen
- DB-Erweiterung: newsLanguages Feld
- Signup-Formular erweitern (News-Sprachen Auswahl)
- Einstellungsseite (/account)
- Newsletter Bulk-Versand (Batch-Optimierung)
- Frequenz-abhängige Zusammenfassungen

### Sprint 13: Polish & Stabilisierung
- Workflow-Anonymisierung (für Git-Repo)
- GitHub-Link im Footer
- Backup-Strategie finalisieren
- Staging-Infrastruktur
- Final Code Review

---

## 9. Backlog (zusätzlich)

- [ ] GitHub Symbol/Verlinkung im Footer
- [ ] Workflows anonymisieren (API-Keys/Credentials entfernen) vor Git-Commit
- [ ] Staging-Infrastruktur (Git Branch `develop`, Subdomain `staging.levcon.ai`)
- [ ] Backup-Strategie (SQLite daily, n8n Workflows als JSON im Repo)
- [ ] Final Code Review (Best Practices, Kommentare, Sauberkeit)
- [ ] HTML-Code Erscheinungsbild im Browser prüfen (Desktop & Mobile)
- [ ] SearXNG Engine-Optimierung (Startpage deaktivieren, stabile Engines priorisieren)

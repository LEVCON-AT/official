# Code Nodes — Refined v3 (Language Quota)

Verfeinerte Versionen der n8n Code-Nodes für den AI News Workflow.
v3 führt das 3-Bucket Language-Quota-System ein (10 DE + 10 EN + 10 INTL).

## Dateien

| Datei | Position im Workflow | v3 Änderung |
|-------|---------------------|-------------|
| `01-fetch-all-rss.code.js` | Nach Schedule Trigger, vor "Dedupe by URL" | Unverändert aus v2 |
| `02-score-and-rank.code.js` | Nach "Dedupe by URL", vor "Build Ollama" | **NEU:** 3-Bucket Quota-System |
| `03-build-ollama-request.code.js` | Nach "Score & Rank", vor "Parse LLM JSON" | **NEU:** 30 Items, num_predict 8192, Prompt "keep all" |

## v3 Hauptfeature: Language-Quota-System

### Das Problem
Score & Rank nahm bisher die Top 15 nach Score — unabhängig von der Sprache.
Da die meisten hoch-gewichteten Quellen englischsprachig sind (MIT Tech Review,
Anthropic, OpenAI, arXiv), dominierte Englisch. Deutsche Artikel wurden verdrängt,
obwohl levcon.ai eine österreichische Seite ist.

### Die Lösung: 3-Bucket-System

```
~150 deduplizierte Items (gemischt)
         ↓
    ┌────┴────┬─────────┐
    ↓         ↓         ↓
  DE-Bucket  EN-Bucket  INTL-Bucket
  ('de')     ('en')     (zh, ja, fr, es, ...)
    ↓         ↓         ↓
  Top 10     Top 10     Top 10
  (Score)    (Score)    (Score)
    ↓         ↓         ↓
    └────┬────┴─────────┘
         ↓
    30 Items an Qwen (garantierte Sprach-Verteilung)
```

### Bucket-Definition
- **DE:** `languageOrig === 'de'` (Heise, Golem, Tagesschau, SZ, Der Standard, etc.)
- **EN:** `languageOrig === 'en'` (MIT Tech Review, Ars Technica, Anthropic, etc.)
- **INTL:** alles andere — `zh`, `ja`, `fr`, und künftig `es`, `it`, `pt`

### Umverteilung bei knappen Buckets

| Szenario | Lösung |
|----------|--------|
| DE hat nur 6 Items | 4 freie Slots → EN (österreichische Site, EN als 2. Priorität) |
| INTL hat 0 Items | 10 freie Slots → Split 5 DE + 5 EN |
| DE hat 15, EN hat 5, INTL hat 3 | DE: 10, EN: 5, INTL: 3, 12 frei → alle an DE |

**Priorität:** DE → EN → INTL (heimische Seite hat Vorrang)

### LLM-Prompt-Anpassung

**v2 (alt):** "Select 10 best from 15" → Qwen musste kuratieren + summarisieren
**v3 (neu):** "Keep ALL 30 items, write summaries for each" → Qwen nur summarisieren

Das entlastet das kleine 2B-Modell erheblich — es muss nicht mehr auswählen,
nur noch schreiben. Bessere Qualität bei gleichem Modell.

## Context-Fenster / Token-Kalkulation

| Parameter | v2 | v3 | Qwen3.5:2b Limit |
|-----------|----|----|------------------|
| `num_ctx` (Input + Output) | 32768 | 32768 | 32768 ✓ |
| `num_predict` (Output) | 4096 | **8192** | 32768 ✓ |

**Token-Rechnung für 30 Items:**
- Input: 30 Items × ~100 Tokens + System Prompt ~500 = ~3.500
- Output: 30 Items × ~120 Tokens + 2 Summaries ~400 = ~4.000
- **Gesamt: ~7.500 Tokens von 32.768 (23% Auslastung)** ✓

## Pipeline-Übersicht (v5)

```
Schedule Trigger (06:00 Vienna)
    ↓
[01-fetch-all-rss.code.js]  ← 35 Feeds, max 30/Feed, UTF-8, HTML-Entities dekodiert
    ↓ ~200-400 KI-Items
[Dedupe by URL]  ← bestehender Code-Node (URL + Titel-Dedup)
    ↓ ~150-250 Items
[02-score-and-rank.code.js]  ← 6-Faktor-Scoring + Semantic Dedup + 2-Bucket Quota (DE+EN)
    ↓ 20 Items (10 DE + 10 EN, max 2 pro Quelle pro Sprache)
[03-build-ollama-request.code.js]  ← 2 SERIELLE Ollama-Calls + Merge + Enrichment
    ↓ Direkt geparstes JSON: { summaryDe, summaryEn, items[20] }
    ↓ (KEIN separater Parse LLM JSON Node mehr nötig!)
[POST /api/ai-news/internal/ingest]  ← bestehender HTTP-Request-Node
    ↓
[Trigger Workflow 02 + 03]  ← LinkedIn + Newsletter
```

### WICHTIG: Parse LLM JSON Node

Der v5 Build Ollama Node macht das JSON-Parsing **intern** (inkl. Auto-Repair
und Enrichment). Der alte "Parse LLM JSON" Code-Node ist **nicht mehr nötig**.

**Optionen:**
1. **Parse Node löschen** — Build Ollama direkt mit Ingest verbinden (empfohlen)
2. **Parse Node als Passthrough** — Code ersetzen durch `return items;`

## Frontend-Auswirkung

Das Frontend rendert bereits alle Items und hat dynamische Sprach-Filter-Tags.
Mit 30 Items in 3 Sprach-Gruppen werden die Filter-Tags sinnvoll nutzbar:

```
[Alle: 30] [DE: 10] [EN: 10] [ZH: 3] [FR: 5] [JA: 2]
```

Der User kann nach Sprache filtern und sieht eine ausgewogene Mischung
statt 28 EN + 1 DE + 1 ZH wie bisher.

## Newsletter Render Node (v2 — Sprint 14b+c)

Die Datei `04-render-newsletter.code.js` ersetzt den "Render Newsletter HTML"
Code-Node im Workflow 03 (newsletter-send). Sie implementiert:

### Sprint 14b: Vereinfachung
- Daily/Weekly/Digest senden alle die gleichen **Tagesnews** (keine Aggregation)
- `lastSentDate` Check: falls heute schon gesendet → Subscriber wird übersprungen
  (verhindert Doppelversand wenn Daily und Digest am selben Tag feuern)

### Sprint 14c: 2-Block-Struktur + Translate-Links
- Newsletter hat **2 Blöcke**:
  1. "AI News International" — alle EN-Items (zuerst, da höheres Interesse)
  2. "KI-News aus dem DACH-Raum" — alle DE-Items (als Bonus)
- Translate-Link bei jedem Item dessen Original-Sprache ≠ Newsletter-Sprache:
  - DE-Newsletter + EN-Item → "Auf Deutsch lesen →" (Google Translate)
  - EN-Newsletter + DE-Item → "Read in English →" (Google Translate)
- Summary in Newsletter-Sprache (summaryDe für DE, summaryEn für EN)
- Block-Überschriften sind sprachneutral ("AI News International" / "KI-News aus dem DACH-Raum")

### Sprach-Logik
- Newsletter-Sprache = Signup-Sprache (wird in DB als `language` gespeichert)
- DE-Site (/) → Subscriber bekommt `language: 'de'` → DE-Newsletter
- EN-Site (/en) → Subscriber bekommt `language: 'en'` → EN-Newsletter
- Änderbar in den Einstellungen (Settings-Seite mit Token)

### Import in n8n
1. Workflow 03 (newsletter-send) öffnen
2. Code-Node "Render Newsletter HTML" anklicken
3. Inhalt ersetzen durch `04-render-newsletter.code.js`

## Import in n8n

1. n8n öffnen → Workflow "AI News — 01 Collect & Curate" bearbeiten
2. Die 3 Code-Nodes durch die neuen Versionen ersetzen:
   - Code-Node "Fetch All RSS" → Inhalt aus `01-fetch-all-rss.code.js`
   - Code-Node "Score & Rank" → Inhalt aus `02-score-and-rank.code.js`
   - Code-Node "Build Ollama Request" → Inhalt aus `03-build-ollama-request.code.js`
3. Verbindungen prüfen:
   - Schedule Trigger → Fetch All RSS → Dedupe by URL → Score & Rank → Build Ollama → Parse LLM JSON → Ingest
4. Die 8 einzelnen "Fetch X RSS" HTTP-Request-Nodes können gelöscht werden
5. Merge-Node kann gelöscht werden (Fetch All RSS macht das bereits)

## Konfiguration

### `02-score-and-rank.code.js`

| Variable | Default | Beschreibung |
|----------|---------|-------------|
| `QUOTA_DE` | 10 | Top-N deutsche Items |
| `QUOTA_EN` | 10 | Top-N englische Items |
| `QUOTA_INTL` | 10 | Top-N internationale Items |
| `TOTAL_QUOTA` | 30 | Summe (auto-calculated) |
| `MAX_AGE_HOURS` | 48 | Items älter werden bestraft |
| `MIN_SCORE_THRESHOLD` | 20 | Min Score (ruhiger Tag = weniger Items) |
| `DEDUP_SIMILARITY` | 0.60 | Jaccard-Threshold für Titel-Dedup |

### `03-build-ollama-request.code.js`

| Variable | Default | Beschreibung |
|----------|---------|-------------|
| `num_predict` | 8192 | Output-Token-Limit (für 30 Items) |
| `num_ctx` | 32768 | Context-Window (Input + Output) |
| `temperature` | 0.3 | Deterministisch für JSON, kreativ für Summary |
| `timeout` | 600000 | 10min für CPU-Inference bei 30 Items |

## Logging (für Tuning)

### RSS Sanity Report (aus `01`)
```
═══ RSS SANITY REPORT ═══
Total feeds:         35
✅ OK & KI-Items:     28
⚠️  OK aber 0 Items:  3 → Netzwelt, KI-Campus, ITmedia
❌ Fehler/Dead:       1 → Nikkei Tech (timeout)
✂️  Gecapped:          5 → arXiv cs.AI (28→30), ...
📊 Total KI-Items:    312 (nach Cap)
══════════════════════════
```

### Score Distribution + Quota Report (aus `02`)
```
[Quota] Bucket-Größen: DE=42, EN=180, INTL=28
[Quota] INTL-Freiplätze → DE: +0 (DE voll)
[Score&Rank] Semantic Dedup: 250 → 238 (entfernt 12 ähnliche)
═══ SCORE DISTRIBUTION REPORT ═══
Input (nach URL-Dedup):     250
Nach Semantic Dedup:        238
Bucket-Größen (verfügbar):  DE=42, EN=168, INTL=28
Final Output:               30 (Quota: DE=10, EN=10, INTL=10)
Avg Score (Final):          67
Highest Score:              94
Lowest Score (Final):       41
═══════════════════════════════
[Score&Rank] Sprach-Verteilung im Output:
  DE: 10x
  EN: 10x
  ZH: 3x
  FR: 5x
  JA: 2x
```

## Qualitätshinweis

Qwen3.5:2b ist ein 2B-Modell. Bei 30 Items muss es ~4.000 Output-Tokens
generieren. Das schafft es, aber die Qualität der letzten 5-10 Items könnte
leicht nachlassen (Ermüdungseffekt bei kleinen Modellen).

Falls das auftritt, Optionen:
1. **Auf 21 Items reduzieren:** `QUOTA_DE=7, QUOTA_EN=7, QUOTA_INTL=7`
2. **Auf qwen3.5:7b wechseln** (Sprint 9 war als Model-Upgrade geplant)
3. **2-Stufen-Ansatz:** Stage 1 = Quick-Classification, Stage 2 = Summaries

## Status

- [x] Code erstellt und dokumentiert (v3)
- [x] Syntax validiert
- [ ] In n8n importiert
- [ ] 7-Tage-Testlauf mit Logging
- [ ] Source-Weights + Quota tuning basierend auf Testdaten
- [ ] Production-Go

# Architecture — AI News

**Status:** Draft v1.0
**Last Updated:** 2025-06-25

---

## 1. System Components

### 1.1 Übersicht

```
┌────────────────────────────────────────────────────────────────┐
│  VPS (Owner)                                                   │
│  ┌─────────────────────────┐    ┌────────────────────────┐    │
│  │  n8n (Container/Service)│    │  Next.js (PM2/Systemd) │    │
│  │  Port 5678 (intern)     │    │  Port 3000 (extern)    │    │
│  └──────────┬──────────────┘    └──────────┬─────────────┘    │
│             │                              │                    │
│             │   ┌──────────────────────────┘                    │
│             ↓   ↓                                                │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  SQLite (Datei-basiert, via Prisma)                    │    │
│  │  Pfad: /var/lib/levcon/levcon.db                       │    │
│  └────────────────────────────────────────────────────────┘    │
│             │                                                   │
│             │ Backup täglich 03:00                              │
│             ↓                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  /var/backups/levcon/levcon-YYYY-MM-DD.db.gz           │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
        │              │                  │
        │              │                  │
        ↓              ↓                  ↓
   ┌────────┐    ┌──────────┐      ┌─────────────┐
   │  RSS   │    │ z-ai SDK │      │  LinkedIn   │
   │ Feeds  │    │ (LLM +   │      │  API        │
   │        │    │ Search)  │      │             │
   └────────┘    └──────────┘      └─────────────┘
                                       │
                                       ↓
                                 ┌───────────┐
                                 │  SMTP     │
                                 │ (Mailserver│
                                 │  Postfix  │
                                 │  o.ä.)    │
                                 └───────────┘
```

### 1.2 Komponenten-Verantwortlichkeiten

| Komponente | Verantwortung | Owner |
|---|---|---|
| **Next.js** | Frontend (News-Panel, Signup, Archiv), API-Routes (Confirm/Unsubscribe) | Code |
| **Prisma** | ORM, Schema-Migration, Query-Layer | Code |
| **SQLite** | Persistenz (News-Items, Summaries, Subscribers) | Code + VPS |
| **n8n** | Cron-Trigger, RSS sammeln, LLM-Kuration, LinkedIn-Post, Newsletter-Versand | Workflows |
| **Ollama (Qwen3.5:2b)** | Lokales LLM: Headline-Übersetzung, DE+EN Summaries, Kategorisierung | localhost:11434 |
| **LinkedIn API** | Auto-Post des Daily AI Update | Credentials |
| **SMTP** | Newsletter-Versand | Credentials |

---

## 2. Datenfluss

### 2.1 Täglicher Curation-Flow (v5 — Juli 2026)

```
06:00 Europe/Vienna
   │
   ↓
[n8n Schedule Trigger]
   │
   ↓
[Fetch All RSS] ─── 35 Feeds (DE/EN), max 30/Feed, UTF-8 + HTML-Entities dekodiert
   │                 ~200-400 KI-relevante Items
   ↓
[Dedupe by URL] ─── URL + Titel-Ähnlichkeit, Tracking-Params entfernt
   │                 ~150-250 Items
   ↓
[Score & Rank] ─── 6-Faktor-Scoring + Semantic Dedup + Source-Diversity-Cap
   │                 2-Bucket Quota: 10 DE + 10 EN (max 2 pro Quelle pro Sprache)
   │                 Umverteilung bei knappen Buckets (DE → EN Priorität)
   ↓
[Build Ollama Request] ─── 2 SERIELLE Läufe (entlastet CPU, vermeidet Ermüdung)
   │  ├── DE-Run: 10 DE-Items → Qwen3.5:2b → summaryDe + Items mit headlineEn
   │  └── EN-Run: 10 EN-Items → Qwen3.5:2b → summaryEn + Items mit headlineDe
   │      Ollama: format=json_object, num_predict=6144, enable_thinking=false
   │      Enrichment: LLM-Items mit Originaldaten anreichern (keine fehlenden Felder)
   ↓
[POST /api/ai-news/internal/ingest] ─── SQLite via Prisma
   │  - AiNewsSummary (1x pro Tag, DE + EN Summary)
   │  - AiNewsItem (20x pro Tag, mit headlineDe + headlineEn + descriptionDe + descriptionEn)
   ↓
[Parallel Trigger]
   ├── [Workflow 02: LinkedIn Post]
   └── [Workflow 03: Newsletter Versand]
```

### 2.2 Newsletter-Frequenz-Logik (vereinfacht — Sprint 14b)

**Subscriber wählt bei Signup:**
- `daily` — erhält jeden Tag die aktuelle Tagesausgabe
- `weekly` — erhält sonntags die aktuelle Tagesausgabe (falls nicht schon gesendet)
- `digest` — erhält am 1. des Monats die aktuelle Tagesausgabe (falls nicht schon gesendet)

**Wichtig:** Daily/Weekly/Digest senden alle die gleichen **Tagesnews** (keine Aggregation). `lastSentDate` verhindert Doppelversand wenn Daily und Digest am selben Tag feuern.

### 2.3 Signup-Flow (DSGVO Double-Opt-In)

```
User füllt Formular auf /de oder /en
   │  - email
   │  - language (= aktuelle Locale)
   │  - frequency (daily/weekly/digest)
   │  - Honeypot (verstecktes Feld)
   ↓
POST /api/ai-news/subscribe
   │
   ↓
Validierung (Zod): Email-Format, Frequency-Enum, Honeypot leer
   │
   ↓
Prisma: Subscriber anlegen (confirmed=false, confirmToken=uuid4)
   │
   ↓
SMTP-Mail mit Bestätigungslink an Subscriber
   │  Link: /api/ai-news/confirm?token=<uuid4>
   │  Token verfällt nach 7 Tagen
   ↓
User klickt Link
   │
   ↓
GET /api/ai-news/confirm?token=...
   │
   ↓
Prisma: confirmed=true, confirmedAt=now()
   │
   ↓
Redirect zu /de?news=confirmed (oder /en)
   │
   ↓
User ist ab sofort im Verteiler
```

### 2.4 Unsubscribe-Flow

```
Newsletter-Mail enthält Header: List-Unsubscribe: <mailto:...>, <https://...>
                       und:    List-Unsubscribe-Post: List-Unsubscribe=One-Click
   │
   ↓
User klickt "Abmelden" oder nutzt One-Click
   │
   ↓
GET /api/ai-news/unsubscribe?token=<subscriber-uuid>
   │
   ↓
Prisma: unsubscribedAt=now() (soft delete, 30 Tage Aufbewahrung für Audit)
   │
   ↓
Redirect zu /de?news=unsubscribed
```

---

## 3. Frontend-Architektur

### 3.1 Routing

Bestehende Site ist eine Single-Page mit Panels. AI News wird als **zusätzliches Panel** integriert — keine neue Route!

```
/de  →  Panel "AI NEWS"  →  aktuelle Ausgabe + Archiv-Accordion
/en  →  Panel "AI NEWS"  →  gleiche Inhalte, übersetzt
```

### 3.2 Komponenten-Hierarchie

```
LevconPage (bestehend)
├── ... bestehende Panels ...
├── <AiNewsPanel>           ← neu
│   ├── <AiNewsHeader>      (Titel + Lead)
│   ├── <AiNewsSummary>     (Tageszusammenfassung DE/EN)
│   ├── <AiNewsList>
│   │   └── <AiNewsItem>   (5-10x)
│   │       ├── Headline + Source + Datum
│   │       ├── Expand-Button (aria-expanded)
│   │       └── External-Link-Button
│   ├── <AiNewsArchive>     (Accordion, kollabiert)
│   │   └── <AiNewsDay>    (pro vergangener Tag)
│   └── <AiNewsSignup>     (Newsletter-Formular)
└── ... bestehende Panels ...
```

### 3.3 Aufklapp-Logik (AiNewsItem)

```
[Default-Zustand]
┌──────────────────────────────────────────────┐
│ ▸ Headline des Artikels            [Quelle]  │
│   Datum                              [↗]    │
└──────────────────────────────────────────────┘

[Aufgeklappt]
┌──────────────────────────────────────────────┐
│ ▾ Headline des Artikels            [Quelle]  │
│   Datum                              [↗]    │
│                                                │
│   ┌──────┐  Kurzzusammenfassung auf Deutsch  │
│   │ Thumb│  (2-3 Sätze, von LLM erstellt)    │
│   │ 60×60│                                     │
│   └──────┘  "Weiterlesen →" (externer Link)  │
└──────────────────────────────────────────────┘
```

**Zwei Aktionssymbole:**
1. **▸ / ▾** (Chevron) — klappt die Zusammenfassung auf/zu
2. **↗** (External-Link) — öffnet Source-URL in neuem Tab

**Accessibility:**
- `aria-expanded` am Chevron
- `aria-label` an beiden Buttons
- Tastatur: Enter/Space auf Chevron, Enter auf External

### 3.4 Signup-Komponente

```
┌──────────────────────────────────────────────┐
│ AI News Newsletter                            │
│                                                │
│ Täglich kuratiert. Kein Spam. Jederzeit       │
│ abmeldbar.                                     │
│                                                │
│ [E-Mail Adresse              ]                 │
│ Frequenz: ( ) Daily  ( ) Weekly  ( ) Digest   │
│                                                │
│ ☐ Ich stimme der Verarbeitung meiner Daten    │
│   gemäß Datenschutzerklärung zu.              │
│                                                │
│ [Honeypot - versteckt]                         │
│                                                │
│           [ Abonnieren → ]                     │
└──────────────────────────────────────────────┘
```

---

## 4. API-Endpunkte

| Methode | Pfad | Zweck | Auth |
|---|---|---|---|
| GET | `/api/ai-news/today` | Aktuelle Ausgabe (Summary + Items) | Public |
| GET | `/api/ai-news/archive?limit=30` | Vergangene Ausgaben (Liste) | Public |
| GET | `/api/ai-news/day/<date>` | Spezifischer Tag | Public |
| POST | `/api/ai-news/subscribe` | Signup-Formular-Submit | Public (Honeypot) |
| GET | `/api/ai-news/confirm?token=...` | Double-Opt-In Bestätigung | Public |
| GET | `/api/ai-news/unsubscribe?token=...` | Abmeldung | Public |
| GET | `/api/ai-news/health` | Health-Check (für n8n) | Public |

---

## 5. Externe Dienste

### 5.1 Ollama (Qwen3.5:2b)
- **Use Cases:**
  - Headline-Übersetzung (DE↔EN) für jedes Item
  - DE+EN Summaries für jedes Item
  - Tageszusammenfassung (summaryDe + summaryEn)
  - Kategorisierung (research|business|regulation|tools|society)
- **Integration:** via n8n Code-Node mit `this.helpers.httpRequest` (POST localhost:11434/api/chat)
- **Modell:** qwen3.5:2b (2B Parameter, CPU-Inference, ~1.2GB RAM)
- **2 serielle Läufe:** DE-Run (10 Items) dann EN-Run (10 Items)

### 5.2 LinkedIn API
- **Use Case:** 1× täglich Auto-Post
- **Auth:** OAuth2 (Access Token via n8n Credential)
- **Scope:** `w_member_social` (Post als Organization oder Person)
- **Dokumentation:** `docs/LINKEDIN-API.md`

### 5.3 RSS-Feeds
Siehe `docs/SOURCES.md` für vollständige Liste.

### 5.4 SMTP
- **Use Case:** Newsletter-Versand
- **Auth:** SMTP-Credentials
- **DKIM/SPF/DMARC:** konfiguriert für `levcon.ai`-Domain

---

## 6. Skalierung & Limits

### 6.1 Erwartetes Volumen
- News-Items: 5-10 pro Tag × 365 Tage = ~3.000 Items/Jahr
- Subscribers: Schätzung 100-500 im ersten Jahr
- Newsletter-Mails: 100-500/Tag (worst case bei daily)

### 6.2 Performance
- SQLite gut für < 100k Datensätze — ausreichend
- News-Liste server-gerendert (keine Client-Fetches für initiale Ansicht)
- Caching via Next.js `revalidate = 3600` (1 Stunde)

### 6.3 Fallback
- Wenn n8n-Workflow fehlschlägt: Mail an Owner
- Wenn LLM nicht verfügbar: Use Top-3 RSS-Items ohne Curation (Fallback)
- Wenn LinkedIn-API fehlschlägt: Keine Auto-Wiederholung, Owner wird benachrichtigt

---

## 7. Security-Betrachtungen

### 7.1 Threat-Model
- **Spam-Abuse:** Signup-Formular → Honeypot + Time-Check + Rate-Limit
- **Newsletter-Bombing:** Eine Mail pro Subscriber, Rate-Limit auf SMTP
- **Token-Leak:** Confirm-Tokens UUID4, 7 Tage gültig, danach hard delete
- **SQL-Injection:** Nur Prisma-Parameterized-Queries
- **XSS:** React auto-escaping, kein dangerouslySetInnerHTML für User-Content
- **CSRF:** SameSite=Strict Cookies, Origin-Check bei POST

### 7.2 Datenschutz
- Subscriber-Daten: E-Mail, Sprache, Frequenz, Status, Datum
- Keine IPs gespeichert
- Keine User-Agent-Speicherung
- Logs: E-Mails maskiert (`a***@***.com`)
- Backups: verschlüsselt at rest (VPS-LUKS oder file-level)

---

## 8. Monitoring & Alerting

| Metric | Threshold | Action |
|---|---|---|
| n8n Workflow Fehler | 3 aufeinanderfolgende | E-Mail an Owner |
| API 5xx-Fehler | > 1% Requests/Tag | Log + Mail |
| Signup-Rate | > 100/Tag (Spam-Verdacht) | Rate-Limit verschärfen |
| Newsletter Bounce-Rate | > 5% | SMTP-Config prüfen |
| DB-Größe | > 100 MB | Archive alte News (>1 Jahr) |

---

## 9. Offene Architektur-Fragen

- [ ] LinkedIn als Person oder als Organization posten? (Owner-Entscheidung)
- [ ] Newsletter-Versand via VPS-SMTP oder externer Dienst (SendGrid, etc.)?
- [ ] Backup-Strategie: nur lokal oder offsite (z.B. rsync zu second VPS)?

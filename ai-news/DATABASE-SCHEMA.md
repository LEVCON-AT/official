# Database Schema — AI News

**ORM:** Prisma
**Database:** SQLite
**Status:** Draft v1.0
**Last Updated:** 2025-06-25

---

## 1. Schema-Übersicht

```
┌──────────────────────┐       ┌──────────────────────────┐
│   AiNewsSummary      │       │   AiNewsItem             │
│──────────────────────│       │──────────────────────────│
│ id          Int  PK │◀──────│ id             Int  PK   │
│ date        DateTime │ 1───n │ summaryId     Int  FK   │
│ summary_de  String   │       │ position       Int      │
│ summary_en  String?  │       │ headline       String   │
│ createdAt   DateTime │       │ description_de String   │
│                      │       │ description_en String?  │
│ @unique(date)        │       │ source         String   │
└──────────────────────┘       │ source_url     String   │
                                │ thumbnail_url  String?  │
                                │ language_orig  String   │
                                │ createdAt      DateTime │
                                │                              │
                                │ @@index([summaryId])        │
                                └──────────────────────────┘

┌──────────────────────────────────┐
│   NewsletterSubscriber           │
│──────────────────────────────────│
│ id              Int  PK          │
│ email           String  @unique  │
│ language        String           │
│ frequency       String           │  // "daily" | "weekly" | "digest"
│ confirmToken    String  @unique  │
│ confirmedAt     DateTime?        │
│ unsubscribedAt  DateTime?        │
│ lastSentDate    DateTime?        │
│ createdAt       DateTime         │
│                                  │
│ @@index([email])                 │
│ @@index([language, frequency])   │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│   WorkflowRun (optional, für    │
│   n8n-Monitoring)                │
│──────────────────────────────────│
│ id           Int  PK             │
│ workflowId   String              │
│ runAt        DateTime            │
│ status       String              │  // "success" | "error" | "partial"
│ itemCount    Int?                │
│ error        String?             │
│ createdAt    DateTime            │
│                                  │
│ @@index([workflowId, runAt])     │
└──────────────────────────────────┘
```

---

## 2. Vollständiges Prisma-Schema

```prisma
// prisma/schema.prisma — Ergänzung zur bestehenden Schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ═══════════════════════════════════════════════════════════
//  AI NEWS — Tägliche kuratierte KI-News
// ═══════════════════════════════════════════════════════════

model AiNewsSummary {
  id          Int      @id @default(autoincrement())
  date        DateTime @unique @db.Date
  summaryDe   String   @map("summary_de")
  summaryEn   String?  @map("summary_en")
  createdAt   DateTime @default(now()) @map("created_at")

  items       AiNewsItem[]

  @@map("ai_news_summaries")
}

model AiNewsItem {
  id              Int      @id @default(autoincrement())
  summaryId       Int      @map("summary_id")
  position        Int
  headline        String
  descriptionDe   String   @map("description_de")
  descriptionEn   String?  @map("description_en")
  source          String
  sourceUrl       String   @map("source_url")
  thumbnailUrl    String?  @map("thumbnail_url")
  languageOrig    String   @map("language_orig") @default("en")
  createdAt       DateTime @default(now()) @map("created_at")

  summary         AiNewsSummary @relation(fields: [summaryId], references: [id], onDelete: Cascade)

  @@index([summaryId])
  @@index([position])
  @@map("ai_news_items")
}

// ═══════════════════════════════════════════════════════════
//  NEWSLETTER — Subscriber-Verwaltung
// ═══════════════════════════════════════════════════════════

model NewsletterSubscriber {
  id              Int       @id @default(autoincrement())
  email           String    @unique
  language        String    @default("de")  // "de" | "en"
  frequency       String    @default("daily") // "daily" | "weekly" | "digest"
  confirmToken    String    @unique @map("confirm_token")
  confirmedAt     DateTime? @map("confirmed_at")
  unsubscribedAt  DateTime? @map("unsubscribed_at")
  lastSentDate    DateTime? @map("last_sent_date")
  createdAt       DateTime  @default(now()) @map("created_at")

  @@index([email])
  @@index([language, frequency])
  @@index([confirmToken])
  @@map("newsletter_subscribers")
}

// ═══════════════════════════════════════════════════════════
//  WORKFLOW-RUNS — n8n-Monitoring (optional)
// ═══════════════════════════════════════════════════════════

model WorkflowRun {
  id           Int       @id @default(autoincrement())
  workflowId   String    @map("workflow_id")
  runAt        DateTime  @map("run_at")
  status       String    // "success" | "error" | "partial"
  itemCount    Int?      @map("item_count")
  errorMessage String?   @map("error_message")
  createdAt    DateTime  @default(now()) @map("created_at")

  @@index([workflowId, runAt])
  @@map("workflow_runs")
}
```

---

## 3. Feld-Spezifikationen

### 3.1 AiNewsSummary

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `id` | Int (PK) | Ja | Auto-Increment |
| `date` | Date | Ja | UTC-Datum, eindeutig (ein Summary pro Tag) |
| `summaryDe` | String | Ja | Redaktionelle Zusammenfassung auf Deutsch (3-5 Sätze) |
| `summaryEn` | String? | Nein | Englische Version (Fallback: gleich wie DE) |
| `createdAt` | DateTime | Ja | Erstellungszeitpunkt |

### 3.2 AiNewsItem

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `id` | Int (PK) | Ja | Auto-Increment |
| `summaryId` | Int (FK) | Ja | Verweis auf AiNewsSummary |
| `position` | Int | Ja | Sortierreihenfolge (1-10) |
| `headline` | String | Ja | Original-Headline (nicht übersetzt) |
| `descriptionDe` | String | Ja | Deutsche Zusammenfassung (1-2 Sätze) |
| `descriptionEn` | String? | Nein | Englische Version |
| `source` | String | Ja | Publisher (z.B. "Heise", "MIT Tech Review") |
| `sourceUrl` | String | Ja | Vollständige URL zum Originalartikel |
| `thumbnailUrl` | String? | Nein | URL zum Thumbnail (wenn frei verwendbar) |
| `languageOrig` | String | Ja | Original-Sprache ("de", "en", etc.) |
| `createdAt` | DateTime | Ja | Erstellungszeitpunkt |

### 3.3 NewsletterSubscriber

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `id` | Int (PK) | Ja | Auto-Increment |
| `email` | String (unique) | Ja | Kleingeschrieben, getrimmt |
| `language` | String | Ja | "de" oder "en" (entspricht Signup-Locale) |
| `frequency` | String | Ja | "daily", "weekly" oder "digest" |
| `confirmToken` | String (unique) | Ja | UUID4 für Double-Opt-In |
| `confirmedAt` | DateTime? | Nein | NULL bis bestätigt |
| `unsubscribedAt` | DateTime? | Nein | NULL bis abgemeldet (soft delete) |
| `lastSentDate` | DateTime? | Nein | Letzter Versand (für Frequency-Logik) |
| `createdAt` | DateTime | Ja | Signup-Zeitpunkt |

**Invariants:**
- `confirmedAt` kann nicht vor `createdAt` liegen
- `unsubscribedAt` kann nicht vor `confirmedAt` liegen
- `email` ist immer lowercase + trimmed
- `confirmToken` ist UUID4 (kryptographisch sicher)

---

## 4. Indizes & Query-Pattern

### 4.1 Primäre Query-Pattern

```sql
-- Aktuelle Ausgabe laden
SELECT s.*, i.* FROM ai_news_summaries s
LEFT JOIN ai_news_items i ON i.summary_id = s.id
WHERE s.date = DATE('now')
ORDER BY i.position;

-- Archiv (letzte 30 Tage)
SELECT * FROM ai_news_summaries
WHERE date < DATE('now')
ORDER BY date DESC
LIMIT 30;

-- Newsletter-Versand: Daily Subscriber
SELECT * FROM newsletter_subscribers
WHERE confirmed_at IS NOT NULL
  AND unsubscribed_at IS NULL
  AND frequency = 'daily'
  AND language = 'de';
```

### 4.2 Indizes

| Tabelle | Index | Use Case |
|---|---|---|
| `ai_news_summaries` | `@unique(date)` | Tagesabfrage verhindern Duplikate |
| `ai_news_items` | `@@index([summaryId])` | Items pro Summary laden |
| `ai_news_items` | `@@index([position])` | Sortierung |
| `newsletter_subscribers` | `@unique(email)` | Duplikate verhindern |
| `newsletter_subscribers` | `@@index([language, frequency])` | Newsletter-Versand |
| `newsletter_subscribers` | `@@index([confirmToken])` | Confirm/Unsubscribe |

---

## 5. Migration-Strategie

### 5.1 Ersteinrichtung
```bash
# Schema bearbeiten
vim prisma/schema.prisma

# Migration erstellen
bun run db:push

# Verifizieren
sqlite3 prisma/levcon.db ".tables"
```

### 5.2 Schema-Änderungen im Laufenden Betrieb
- SQLite unterstützt `ALTER TABLE ADD COLUMN` (eingeschränkt)
- Bei Breaking Changes: Dump → neue DB → Restore
- Production-Migration immer zuerst auf Staging testen

### 5.3 Rollback
- Backup vor jeder Migration (`sqlite3 levcon.db ".dump" > backup.sql`)
- Rollback: `sqlite3 levcon.db < backup.sql`

---

## 6. Daten-Lebenszyklus

### 6.1 Retention-Policy
| Datentyp | Aufbewahrung | Löschung |
|---|---|---|
| `AiNewsSummary` | 5 Jahre | Danach archivieren (export + delete) |
| `AiNewsItem` | 5 Jahre | Mit Summary |
| `NewsletterSubscriber` (aktiv) | Unbegrenzt | Auf User-Request |
| `NewsletterSubscriber` (unsubscribed) | 30 Tage | Hard delete nach 30 Tagen |
| `NewsletterSubscriber` (unconfirmed) | 7 Tage | Hard delete nach 7 Tagen |
| `WorkflowRun` | 90 Tage | Cronjob löscht ältere |

### 6.2 Cleanup-Jobs (n8n)
- **Täglich:** Lösche unconfirmed Subscribers älter als 7 Tage
- **Täglich:** Lösche unsubscribed Subscribers älter als 30 Tage
- **Wöchentlich:** Lösche WorkflowRuns älter als 90 Tage
- **Jährlich:** Archiviere NewsItems/Summaries älter als 5 Jahre

---

## 7. Beispiel-Daten

### 7.1 AiNewsSummary
```json
{
  "id": 1,
  "date": "2025-06-25T00:00:00.000Z",
  "summaryDe": "Heute dominiert die Ankündigung von OpenAI's neuem Reasoning-Modell. Europäische Regulierungsbehörden verschärfen derweil den Blick auf Trainingsdaten. Auch bemerkenswert: Eine Studie zeigt, dass KI-gestützte Code-Review-Tools die Fehlerquote in Enterprise-Projekten um 23% senken.",
  "summaryEn": "Today's headlines are dominated by OpenAI's new reasoning model announcement. European regulators are tightening scrutiny on training data. Also notable: A study shows AI-assisted code review tools reduce error rates in enterprise projects by 23%.",
  "createdAt": "2025-06-25T04:02:13.000Z"
}
```

### 7.2 AiNewsItem
```json
{
  "id": 1,
  "summaryId": 1,
  "position": 1,
  "headline": "OpenAI announces o3-mini with improved reasoning",
  "descriptionDe": "Das neue Modell verbessert logisches Schließen bei reduzierten Kosten. Erste Benchmarks zeigen deutliche Fortschritte bei Mathematik und Code-Aufgaben.",
  "descriptionEn": "The new model improves logical reasoning at reduced cost. Initial benchmarks show significant progress in mathematics and code tasks.",
  "source": "MIT Tech Review",
  "sourceUrl": "https://www.technologyreview.com/2025/06/25/example",
  "thumbnailUrl": "https://www.technologyreview.com/example-thumb.jpg",
  "languageOrig": "en",
  "createdAt": "2025-06-25T04:02:13.000Z"
}
```

### 7.3 NewsletterSubscriber
```json
{
  "id": 1,
  "email": "user@example.com",
  "language": "de",
  "frequency": "daily",
  "confirmToken": "550e8400-e29b-41d4-a716-446655440000",
  "confirmedAt": "2025-06-25T10:15:00.000Z",
  "unsubscribedAt": null,
  "lastSentDate": "2025-06-25T06:00:00.000Z",
  "createdAt": "2025-06-25T10:12:00.000Z"
}
```

---

## 8. Validierung auf Application-Level

### 8.1 E-Mail
- Regex: `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- Normalisierung: lowercase + trim
- Existenz-Check: nicht via SMTP (DSGVO: keine unerwarteten Verbindungen)

### 8.2 URLs
- Regex oder `URL` constructor
- Nur `http://` und `https://` erlaubt
- Keine `javascript:` oder `data:` Schemes

### 8.3 Frequency
- Enum: `["daily", "weekly", "digest"]`
- Default: `"daily"`

### 8.4 Language
- Enum: `["de", "en"]`
- Default: `"de"`

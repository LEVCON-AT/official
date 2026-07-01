# AI NEWS — Master Context

**Projekt:** Levcon.ai AI News — täglicher kuratierter KI-Presse-Review
**Owner:** Enric-Bernard Sep-Albi (Levcon.ai)
**Gestartet:** 2025-06-25 (ursprünglich), rekonstruiert 2025-07-01
**Status:** In Implementation

---

## 1. Ziel & Vision

Eine tägliche, kuratierte KI-News-Sektion auf levcon.ai, die:
- 5–10 relevante KI-Headlines pro Tag als Pressespiegel zeigt
- Eine redaktionelle Kurzzusammenfassung des Tages bietet
- Newsletter-Abonnenten die Zusammenfassung per Mail zustellt
- Auf LinkedIn automatisiert gepostet wird
- Mehrsprachig (DE/EN) funktioniert, sprachabhängig je nach Signup-Locale
- Voll in die bestehende minimalistische Levcon-Website integriert ist

## 2. Schlüsselanforderungen (vom Owner)

| # | Anforderung | Priorität |
|---|---|---|
| 1 | Seriöse Quellen, keine bevorzugten Vorgaben | HIGH |
| 2 | LinkedIn: tägliches AI Update (Daily AI Update) | HIGH |
| 3 | Newsletter-Frequenz vom Subscriber wählbar (Daily/Weekly/Digest), keine Inhalte verloren | HIGH |
| 4 | Signup-Sprache = Newsletter-Sprache (DE oder EN), Fallback bilingual | HIGH |
| 5 | Archiv sichtbar, aber dezent | MEDIUM |
| 6 | Listenansicht kompakt (Headline only); Aufklappen für Summary + Thumbnail; zwei Aktionssymbole (Aufklappen & externer Link); Newsletter mit voller Summary + Thumbnail + Link je Artikel | HIGH |
| 7 | DSGVO-konform (Double-Opt-In, Abmeldelink, keine Tracker) | HIGH |
| 8 | n8n-Workflows ready-to-import, mit Platzhaltern für API-Keys | HIGH |
| 9 | Voller VPS-Setup (DB, n8n, SMTP, LinkedIn-API) dokumentiert | HIGH |
| 10 | Placeholder/Config für API-Keys — Owner muss einrichten | HIGH |

## 3. Architektur

```
┌─────────────────────────────────────────────────────────────┐
│  n8n (VPS) — täglicher Workflow 06:00 CET                   │
│  - RSS + Web-Search sammeln                                 │
│  - LLM (z-ai) kuratiert + fasst zusammen (DE/EN)            │
│  - SQLite (Prisma) speichert                                │
│  - Parallel: LinkedIn Post + Newsletter Versand             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Next.js 16 App                                             │
│  - Panel "AI NEWS" liest aus SQLite via Prisma              │
│  - Server-Component, revalidate=3600 (1h cache)             │
│  - Signup-Formular + Double-Opt-In via API                  │
└─────────────────────────────────────────────────────────────┘
```

## 4. Sprint-Übersicht

| Sprint | Titel | Paket-Typ | Status |
|---|---|---|---|
| 1 | DB-Schema & Migration | Backend | ✅ Done |
| 2 | n8n: Collect & Curate Workflow | Backend | Pending (braucht VPS) |
| 3 | n8n: LinkedIn Post Workflow | Backend | Pending (braucht LinkedIn-API) |
| 4 | n8n: Newsletter Send Workflow | Backend | Pending (braucht SMTP) |
| 5 | Frontend: News-Panel (Liste + Aufklappen) | Frontend | ✅ Done |
| 6 | Frontend: Signup-Formular + Double-Opt-In | Fullstack | Pending |
| 7 | Archiv + Polish + DSGVO-Texte | Both | Pending |
| 8 | VPS-Deployment & Smoke-Test | DevOps | Pending |

## 5. Quality-Gates (für jeden Sprint)

1. **Code-Complete:** Alle Akzeptanzkriterien erfüllt
2. **Lint & Build:** `bun run lint` 0 Errors, Build erfolgreich
3. **Manuelle Validierung:** Dev-Server, Browser-Check, Edge-Cases
4. **Doku-Update:** Sprint-Doku, Code-Review, Test-Results
5. **Commit & Push:** Conventional Commits Format

## 6. Offene Punkte (vor jeweiligen Sprints zu klären)

- [ ] VPS-Zugangsdaten (für Sprint 2, 8)
- [ ] LinkedIn-API-Credentials (für Sprint 3)
- [ ] SMTP-Credentials (für Sprint 4, 6)
- [ ] LLM-API-Key für curation (z-ai-web-dev-sdk)

## 7. Code-Standards

- TypeScript strict, kein `any`
- Prisma mit `@map` für snake_case Spaltennamen
- Server-Components bevorzugt, `'use client'` nur wenn nötig
- WCAG 2.1 AA (aria-expanded, focus-visible, Kontrast ≥ 4.5:1)
- DSGVO: Double-Opt-In, keine IPs, One-Click-Unsubscribe (RFC 8058)
- Levcon-Design: Creme (#F0EFEC), Schwarz (#1C1C1A), Rot (#C8102E)
- Conventional Commits: `feat(ai-news): ...`

## 8. Verwandte Dateien

- `prisma/schema.prisma` — 4 neue Models (AiNewsSummary, AiNewsItem, NewsletterSubscriber, WorkflowRun)
- `src/components/ainews/AiNewsItem.tsx` — Client-Komponente mit Aufklapp-Logik
- `src/components/ainews/data.ts` — Server-Helper: `getTodaysNews()`
- `src/components/LevconPage.tsx` — Integration des AI News-Panels
- `src/app/[locale]/page.tsx` — Lädt News serverseitig, übergibt an LevconPage
- `src/messages/{de,en}.json` — i18n-Strings unter `ainews.*`
- `src/app/globals.css` — Styles unter `/* ── AI NEWS ── */`

## 9. Nächste Schritte

- Sprint 6 (Signup-Formular + Double-Opt-In) — kann sofort lokal starten
- Sprint 2-4 (n8n-Workflows) — brauchen VPS + Credentials
- Sprint 7 (Archiv + Polish) — nach Sprint 6
- Sprint 8 (VPS-Deployment) — nach allen Sprints

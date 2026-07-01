# AI NEWS — Master Context

**Projekt:** Levcon.ai AI News — täglicher kuratierter KI-Presse-Review
**Owner:** Enric-Bernard Sep-Albi (Levcon.ai)
**Gestartet:** 2025-06-25
**Status:** Planning

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

## 3. Architektur-Überblick

```
┌─────────────────────────────────────────────────────────────┐
│  n8n (VPS) — täglicher Workflow 06:00                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Cron 06:00                                       │   │
│  │ 2. RSS + Web-Search sammeln                         │   │
│  │ 3. LLM kuratieren + DE/EN zusammenfassen            │   │
│  │ 4. SQLite (Prisma) speichern                        │   │
│  │ 5. Parallel:                                        │   │
│  │    a) LinkedIn Post (DE)                             │   │
│  │    b) Newsletter Versand (je Sprache & Frequenz)    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Next.js 16 App                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Panel "AI NEWS" — liest aus SQLite via Prisma       │   │
│  │ → Aktuelle Ausgabe + Archiv (Aufklapp-Accordion)    │   │
│  │ → Signup-Formular (DE/EN)                           │   │
│  │ → Double-Opt-In via API                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 4. Dokumentenstruktur

```
ai-news/
├── CONTEXT.md                  ← Dieses Dokument (Master)
├── QUALITY-GUIDELINES.md       ← Verbindliche Coding-Standards
├── ARCHITECTURE.md             ← Technische Architektur & Datenmodell
├── DATABASE-SCHEMA.md          ← Prisma-Schema-Design
├── SPRINT-PLAN.md              ← Sprint-Pakete & Abhängigkeiten
├── VPS-SETUP.md                ← VPS-Setup-Anleitung
├── CODE-REVIEW.md              ← Code-Review-Log (wird fortlaufend gepflegt)
├── TEST-RESULTS.md             ← Test- & Validierungsergebnisse
├── ENV-TEMPLATE.md             ← .env-Platzhalter (ohne echte Werte)
├── sprints/
│   ├── SPRINT-01-DB-SCHEMA.md
│   ├── SPRINT-02-N8N-COLLECT-WORKFLOW.md
│   ├── SPRINT-03-N8N-LINKEDIN-WORKFLOW.md
│   ├── SPRINT-04-N8N-NEWSLETTER-WORKFLOW.md
│   ├── SPRINT-05-FRONTEND-NEWS-PANEL.md
│   ├── SPRINT-06-FRONTEND-SIGNUP-FORM.md
│   └── SPRINT-07-ARCHIVE-AND-POLISH.md
├── n8n-workflows/
│   ├── README.md
│   ├── workflow-01-collect-and-curate.json
│   ├── workflow-02-linkedin-post.json
│   └── workflow-03-newsletter-send.json
├── docs/
│   ├── SOURCES.md              ← RSS-Quellen-Liste
│   ├── LINKEDIN-API.md         ← LinkedIn-API-Setup
│   └── SMTP-SETUP.md           ← Mailserver-Konfiguration
└── templates/
    ├── newsletter-html-de.html
    ├── newsletter-html-en.html
    └── linkedin-post-template.md
```

## 5. Sprint-Übersicht (Kurzfassung, Details in SPRINT-PLAN.md)

| Sprint | Titel | Paket-Typ | Status |
|---|---|---|---|
| 1 | DB-Schema & Migration | Backend | Pending |
| 2 | n8n Workflow: Collect & Curate | Backend | Pending |
| 3 | n8n Workflow: LinkedIn Post | Backend | Pending |
| 4 | n8n Workflow: Newsletter Send | Backend | Pending |
| 5 | Frontend: News-Panel (Liste + Aufklappen) | Frontend | Pending |
| 6 | Frontend: Signup-Formular + Double-Opt-In | Frontend | Pending |
| 7 | Archiv + Polish + DSGVO-Texte | Both | Pending |

## 6. Verbindliche Regeln für jeden Sprint

Vor jedem Sprint MUSS der Agent folgende Schritte dokumentieren:

1. **Sprint-Ziel** (was wird geliefert?)
2. **Akzeptanzkriterien** (wann ist der Sprint done?)
3. **Implementierungsschritte** (chronologisch)
4. **Validierung** (Tests, Lint, Browser-Check)
5. **Code-Review** (Self-Review nach QUALITY-GUIDELINES.md)
6. **Update** dieser Datei: Status-Feld aktualisieren
7. **Commit** mit eindeutiger Message (`feat(ai-news): <sprint> ...`)

## 7. Offene Punkte (vor Sprint 1 zu klären)

- [ ] VPS-Zugangsdaten (Owner: SSH, n8n-URL)
- [ ] LinkedIn-API-Credentials (Owner)
- [ ] SMTP-Credentials für Newsletter (Owner)
- [ ] LLM-API-Key für curation (z-ai-web-dev-sdk vorhanden)
- [ ] Web-Search-API-Key (z-ai-web-dev-sdk vorhanden)
- [ ] Domain für Mail-Versand ( SPF/DKIM/DMARC )

Bis diese verfügbar sind, werden in Code & Workflows Platzhalter verwendet.

## 8. Referenz-Dokumente

- [QUALITY-GUIDELINES.md](./QUALITY-GUIDELINES.md) — Coding-Standards
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Technische Details
- [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) — Prisma-Modell
- [SPRINT-PLAN.md](./SPRINT-PLAN.md) — Sprint-Aufteilung
- [VPS-SETUP.md](./VPS-SETUP.md) — VPS-Setup
- [ENV-TEMPLATE.md](./ENV-TEMPLATE.md) — .env-Platzhalter

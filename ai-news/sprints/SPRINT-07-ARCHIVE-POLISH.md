# Sprint 7 — Archiv + Polish + DSGVO-Texte

**Status:** Done ✅ (Code-Complete)
**Started:** 2025-07-01
**Finished:** 2025-07-01
**Paket-Typ:** Both
**Aufwand:** 2-3h
**Abhängigkeit:** S5, S6 (erledigt)

---

## Ziel

1. Archiv-Funktion für vergangene AI News-Ausgaben (dezent, aufklappbar)
2. DSGVO-Texte um AI News Newsletter + externe Links erweitern
3. Polish (Spacing, Kontraste, Mobile-Optimierung)
4. Cleanup-Job-Dokumentation (n8n-Workflow für Retention)

## Akzeptanzkriterien — Alle erfüllt ✅

- [x] Archiv-Accordion im AI News-Panel (zwischen News-Liste und Signup)
- [x] Archiv zeigt vergangene Tage mit Datum, Summary, Items
- [x] Archiv ist initial kollabiert ("Archiv anzeigen" Toggle)
- [x] Archiv-Zähler zeigt Anzahl vergangener Ausgaben
- [x] `getArchivedNews(limit)` Helper in data.ts
- [x] Server-seitiges Laden (parallel zu `getTodaysNews` via Promise.all)
- [x] DSGVO-Texte erweitert: AI News Newsletter, externe Links, Server-Logfiles, Ihre Rechte
- [x] DSGVO auf DE + EN
- [x] Cleanup-Retention-Doku (`docs/CLEANUP-RETENTION.md`)
- [x] i18n-Strings für Archiv (DE/EN)
- [x] Lint: 0 Errors
- [x] JSON-Validierung beider Sprachdateien: ✅

## Implementierung

### Erstellt:
- `src/components/ainews/AiNewsArchive.tsx` — Client-Komponente mit useState für Aufklapp-Logik
- `ai-news/docs/CLEANUP-RETENTION.md` — Doku für n8n Cleanup-Workflow

### Geändert:
- `src/components/ainews/data.ts` — `getArchivedNews(limit)` Helper hinzugefügt
- `src/app/[locale]/page.tsx` — Lädt Archiv parallel zu Today-News via Promise.all
- `src/components/LevconPage.tsx` — `archivedNews` Prop, AiNewsArchive zwischen News und Signup
- `src/app/globals.css` — Styles für `.ainews-archive-*` Klassen
- `src/messages/de.json` + `en.json` — DSGVO-Texte + Archiv-i18n

### Architektur-Entscheidungen:
1. **Archiv als Accordion** — initial kollabiert, dezent; User muss aktiv aufklappen
2. **Parallel-Loading** — `Promise.all([getTodaysNews(), getArchivedNews()])` für Performance
3. **Limit 30 Tage** — genug für Monatsrückblick, nicht zu schwer für DB
4. **Cap 90 Tage** — in `getArchivedNews` als Sicherheits-Netz gegen schwere Queries
5. **Reuse von AiNewsItem** — gleiche Aufklapp-Logik für Archiv-Items
6. **DSGVO-Vollständigkeit** — Newsletter, externe Links, Server-Logfiles, Rechte dokumentiert

## DSGVO-Erweiterungen

Neue Abschnitte in der Datenschutzerklärung:
1. **AI News Newsletter** — Double-Opt-In, Token-Ablauf, 30-Tage-Retention, SMTP-Provider, kein Tracking
2. **Externe Verlinkungen** — rel="noopener noreferrer nofollow", keine Verantwortung für externe Sites
3. **Server-Logfiles** — Standard-Info über automatische Log-Erstellung
4. **Ihre Rechte** — Auskunft, Berichtigung, Löschung, etc. + zuständige Aufsichtsbehörde

## Validierungsergebnisse

- Lint: ✅ 0 Errors (1 bekannte Warning unrelated)
- TypeScript: ✅ Keine Errors in src/ oder ai-news/
- JSON-Validierung: ✅ de.json + en.json valid
- Code-Review: ✅ Approved (Self-Review)

### Limitationen (Sandbox):
- Dev-Server in Sandbox instabil für Browser-Tests
- Archiv-Aufklapp-Logik muss auf VPS (Sprint 8) im Browser validiert werden

## Code-Review

- Reviewer: Self-Review
- Datum: 2025-07-01
- Entscheidung: Approved

### Findings:
1. **Archiv kann groß werden** — Limit 30 ist OK, aber bei monatelangem Betrieb ggf. Pagination nötig
2. **Archiv nutzt gleiche AiNewsItem-Komponente** — gut für Konsistenz, aber jedes Item hat eigenen State
3. **Cleanup-API-Endpoint noch nicht implementiert** — Doku vorhanden, Implementierung in Sprint 8

## Known Issues

- Cleanup-API-Endpoint (`/api/ai-news/internal/cleanup`) muss in Sprint 8 implementiert werden
- Vollständiger Browser-Test des Archivs muss auf VPS durchgeführt werden
- Test-Daten (1 gestriger Eintrag) müssen vor Production-Go-Live gelöscht werden

## Nächste Schritte

- Sprint 8 (VPS-Deployment & Smoke-Test) — nach Owner-Setup (VPS, SMTP, LinkedIn-API)

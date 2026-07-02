# Sprint 5 — Frontend: News-Panel (Liste + Aufklappen)

**Status:** Done ✅
**Started:** 2025-07-01
**Finished:** 2025-07-01
**Paket-Typ:** Frontend
**Aufwand:** 4-5h
**Abhängigkeit:** S1 (erledigt)

---

## Ziel

Integration eines neuen Panels "AI NEWS" in die bestehende Levcon-Site mit:
1. Tageszusammenfassung (DE/EN)
2. 5-10 News-Items als kompakte Liste
3. Pro Item: Aufklapp-Button für Kurzzusammenfassung + Thumbnail, und externer Link

## Akzeptanzkriterien — Alle erfüllt ✅

- [x] Nav-Button "AI NEWS" zwischen DATENSTRATEGIE und FAQ
- [x] Panel öffnet/schließt wie bestehende Panels
- [x] Tageszusammenfassung prominent oben (mit rotem Border-Left)
- [x] News-Items als kompakte Liste
- [x] Pro Item: Chevron-Button (▸/▾) klappt Summary auf
- [x] Pro Item: External-Link-Button (↗) öffnet Source in neuem Tab
- [x] `rel="noopener noreferrer nofollow"` auf externen Links
- [x] Server-Component (lädt aus DB via Prisma, kein Client-Fetch)
- [x] Caching via `revalidate = 3600`
- [x] i18n-Strings in de.json/en.json
- [x] Mobile: 1-spaltig, Touch-Targets ≥ 44px
- [x] WCAG AA: aria-expanded, Tastatur, Kontrast ≥ 4.5:1
- [x] Lint: 0 Errors
- [x] Browser-Validierung Mobile + Desktop

## Implementierung

### Erstellt:
- `src/components/ainews/AiNewsItem.tsx` — Client-Komponente mit useState für Aufklapp-Logik
- `src/components/ainews/data.ts` — Server-Helper `getTodaysNews()` mit `revalidate = 3600`

### Geändert:
- `src/components/LevconPage.tsx` — Neuer Panel-Abschnitt + Nav-Button
- `src/app/[locale]/page.tsx` — Lädt News serverseitig, übergibt als Prop
- `src/app/globals.css` — Styles für `.ainews-*` Klassen
- `src/messages/de.json` + `en.json` — i18n-Strings unter `ainews.*`
- `prisma/schema.prisma` — 4 neue Models (AiNewsSummary, AiNewsItem, NewsletterSubscriber, WorkflowRun)

### Architektur-Entscheidung:
Da `LevconPage` eine Client-Komponente ist (wegen useState für Panels), die News aber serverseitig geladen werden müssen:
1. `page.tsx` (Server) lädt News via `getTodaysNews()`
2. Übergibt `todaysNews` als Prop an `LevconPage` (Client)
3. `LevconPage` rendert das AI News-Panel inline (wie andere Panels)
4. Pro Item: `AiNewsItem` (Client) verwaltet eigenen Aufklapp-State

## Validierungsergebnisse

- Lint: ✅ 0 Errors
- Build: ✅
- Browser-Check Desktop: ✅
- Browser-Check Mobile: ✅
- A11y (aria-expanded, focus-visible): ✅
- Server-Rendering: ✅

## Code-Review

- Reviewer: Self-Review
- Datum: 2025-07-01
- Entscheidung: Approved

## Known Issues

- Test-Daten (3 Items mit placehold.co Thumbnails) in DB — vor Production löschen
- "No News Today" Edge-Case nicht live getestet (Test-Daten waren vorhanden)

## Nächste Schritte

- Sprint 6 (Signup-Formular + Double-Opt-In) kann starten

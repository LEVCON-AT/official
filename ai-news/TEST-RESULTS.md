# Test Results — AI News

**Status:** Fortlaufend
**Letzte Aktualisierung:** 2025-07-01

---

## Sprint 1 — DB-Schema & Migration

**Datum:** 2025-06-25
**Status:** Passed (rekonstruiert 2025-07-01)

### Validierung
- **`bun run db:push`:** ✅ Erfolgreich
- **Tabellen:** ✅ ai_news_summaries, ai_news_items, newsletter_subscribers, workflow_runs
- **Lint:** ✅ 0 Errors
- **Test-Insert + Query + Cleanup:** ✅

### Entscheidung
✅ Sprint 1 abgeschlossen

---

## Sprint 5 — Frontend: News-Panel

**Datum:** 2025-07-01
**Status:** Passed

### 1. Automatisierte Tests
- **Lint:** ✅ 0 errors, 1 known warning (pre-existing, unrelated)
- **Build:** ✅
- **TypeScript:** ✅ Keine Type-Errors
- **Prisma Client:** ✅ Neue Models verfügbar

### 2. Manuelle Validierung
- **Dev-Server startet:** ✅
- **Dev-Log keine Errors:** ✅
- **Nav-Button "AI News":** ✅ Sichtbar zwischen DATENSTRATEGIE und FAQ
- **Panel öffnet/schließt:** ✅ Smooth animation
- **Browser-Check Desktop (1280px):** ✅
- **Browser-Check Mobile (375px):** ✅ Kein Overflow, Touch-Targets OK

### 3. Edge-Cases
| # | Case | Result | Notes |
|---|---|---|---|
| 1 | Panel mit 3 Test-Items | ✅ | Alle 3 Headlines angezeigt |
| 2 | Aufklapp-Button (Chevron) | ✅ | `aria-expanded` wechselt, Body maximiert auf 400px |
| 3 | Chevron-Rotation | ✅ | 90° Rotation bei `is-open` |
| 4 | External-Link (↗) | ✅ | `rel="noopener noreferrer nofollow"`, target="_blank" |
| 5 | Thumbnail vorhanden | ✅ | 60×60, lazy-loading, alt="" (dekorativ) |
| 6 | Thumbnail null | ✅ | Wird nicht gerendert |
| 7 | "Weiterlesen →" Link | ✅ | In Rot, extern, mit rel-Attribut |
| 8 | DE-Übersetzung | ✅ | Summary + Items auf Deutsch |
| 9 | EN-Übersetzung | ✅ | summaryEn + descriptionEn verwendet |
| 10 | Mobile: Source-Label | ✅ | Auf Mobile ausgeblendet (Platzersparnis) |
| 11 | Mobile: Touch-Target | ✅ | Toggle 279px breit (>44px Min) |
| 12 | Server-Rendering | ✅ | News-Daten im HTML-Quelltext |
| 13 | Caching (revalidate=3600) | ✅ | Konfiguriert in data.ts |
| 14 | Tastatur: Tab + Enter auf Toggle | ✅ | focus-visible outline sichtbar |

### 4. Bekannte Issues
- Test-Daten in DB (3 Items) müssen vor Production-Go-Live gelöscht werden
- `placehold.co` Thumbnails nur für Testing — Production: echte Thumbnails via n8n-Workflow

### 5. Entscheidung
✅ **Sprint 5 abgeschlossen** — bereit für Sprint 6 (Signup-Formular)

---

## Sprint 6 — Signup-Formular + Double-Opt-In

**Datum:** 2025-07-01
**Status:** Passed (Code-Complete, E2E pending VPS)

### 1. Automatisierte Tests
- **Lint:** ✅ 0 errors, 1 known warning (pre-existing, unrelated)
- **TypeScript:** ✅ Keine Type-Errors
- **Build:** ✅

### 2. Manuelle Validierung
- **Dev-Server startet:** ✅
- **Signup-Formular angezeigt:** ✅ Unter News-Liste im AI News-Panel
- **E-Mail-Validierung (client):** ✅ Leere/ungültige E-Mail → Fehlermeldung
- **Consent-Validierung (client):** ✅ Ohne Consent → "Bitte stimmen Sie der Datenschutzerklärung zu."
- **i18n DE/EN:** ✅ Alle Strings übersetzt

### 3. Edge-Cases (Code-Review geprüft)
| # | Case | Result | Notes |
|---|---|---|---|
| 1 | Honeypot-Feld ausgefüllt | ✅ | Silent return OK, kein Eintrag in DB |
| 2 | Submit < 2.5s nach Load | ✅ | Silent return (Bot-Verdacht) |
| 3 | E-Mail bereits angemeldet (confirmed) | ✅ | 409 Conflict |
| 4 | E-Mail bereits angemeldet (unconfirmed) | ✅ | Neuer Token, DOI-Mail erneut |
| 5 | E-Mail nach Unsubscribe erneut angemeldet | ✅ | Reset, neuer Token, Re-Opt-In |
| 6 | Rate-Limit > 5 Signups/Email/h | ✅ | 429 Too Many Requests |
| 7 | Token abgelaufen (>7 Tage) | ✅ | Auto-Delete + Redirect zu error |
| 8 | Token ungültig (<32 chars) | ✅ | Redirect zu error |
| 9 | Confirm-Link nach bereits bestätigt | ✅ | Redirect zu already-confirmed |
| 10 | Unsubscribe (GET) | ✅ | Soft-Delete, Redirect |
| 11 | Unsubscribe (POST, RFC 8058) | ✅ | One-Click-Unsubscribe |
| 12 | Double-Opt-In Mail | ✅ | HTML + Text-Version, Levcon-Branded |
| 13 | List-Unsubscribe Header | ✅ | In DOI-Mail gesetzt |
| 14 | Token-UUID4 | ✅ | crypto.randomUUID() |
| 15 | E-Mail-Normalisierung | ✅ | lowercase + trim |

### 4. Limitationen (Sandbox)
- SMTP-Credentials nicht konfiguriert (Owner muss einrichten)
- Dev-Server in Sandbox instabil → E2E-Test auf VPS verschoben
- DOI-Mail-Versand, Confirm-Redirect, Unsubscribe-Redirect müssen in Sprint 8 validiert werden

### 5. Entscheidung
✅ **Sprint 6 code-complete** — E2E-Validierung in Sprint 8 (VPS) nach SMTP-Setup

---

## Sprint 7 — Archiv + Polish + DSGVO-Texte

**Datum:** Pending
**Status:** Pending

---

## Sprint 8 — VPS-Deployment & Smoke-Test

**Datum:** Pending
**Status:** Pending

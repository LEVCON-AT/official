# Sprint Plan — AI News

**Status:** Draft v1.0
**Last Updated:** 2025-06-25

---

## 1. Sprint-Übersicht

| Sprint | Titel | Typ | Aufwand | Abhängigkeit | Status |
|---|---|---|---|---|---|
| **S1** | DB-Schema & Migration | Backend | 2-3h | — | Pending |
| **S2** | n8n: Collect & Curate Workflow | Backend | 4-5h | S1 | Pending |
| **S3** | n8n: LinkedIn Post Workflow | Backend | 2-3h | S2 | Pending |
| **S4** | n8n: Newsletter Send Workflow | Backend | 3-4h | S2 | Pending |
| **S5** | Frontend: News-Panel (Liste + Aufklappen) | Frontend | 4-5h | S1 | Pending |
| **S6** | Frontend: Signup-Formular + Double-Opt-In | Fullstack | 3-4h | S1 | Pending |
| **S7** | Archiv + Polish + DSGVO-Texte | Both | 2-3h | S5, S6 | Pending |
| **S8** | VPS-Deployment & Smoke-Test | DevOps | 2-3h | S2, S3, S4, S5, S6, S7 | Pending |

**Gesamtaufwand:** ~22-30 Stunden

---

## 2. Parallelität & Reihenfolge

```
S1 (DB) ────────┬─────────────┬─────────────┐
                │             │             │
                ↓             ↓             ↓
               S5            S6            S2 (n8n Core)
            (Frontend      (Signup)         │
             News)                          │
                                            ├── S3 (LinkedIn)
                                            └── S4 (Newsletter)
                                                │
                                                ↓
                                          S7 (Polish)
                                                │
                                                ↓
                                          S8 (VPS Deploy)
```

**Mögliche Parallelität:**
- S5 + S6 nach S1 (Frontend kann parallel zu n8n entwickelt werden)
- S3 + S4 nach S2 (beide n8n-Versand-Workflows parallel)

---

## 3. Sprint-Details

### Sprint 1 — DB-Schema & Migration
**Paket-Typ:** Backend
**Aufwand:** 2-3h
**Abhängigkeit:** —
**Status:** Pending

**Liefergegenstände:**
- Erweiterte `prisma/schema.prisma` mit AI News + Newsletter-Modellen
- Erfolgreicher `bun run db:push`
- Beispiel-Seeding für Testzwecke
- Validierung: Tabellen existieren, Indizes gesetzt

**Akzeptanzkriterien:**
- [ ] Schema enthält `AiNewsSummary`, `AiNewsItem`, `NewsletterSubscriber`, `WorkflowRun`
- [ ] `bun run db:push` erfolgreich ohne Errors
- [ ] Test-Insert via Prisma Client funktioniert
- [ ] Indizes in SQLite sichtbar (`.indexes`)

**Validierung:**
- Lint-Check
- Manueller DB-Test via Node-Script
- Prisma Studio Check

---

### Sprint 2 — n8n: Collect & Curate Workflow
**Paket-Typ:** Backend (n8n)
**Aufwand:** 4-5h
**Abhängigkeit:** S1
**Status:** Pending

**Liefergegenstände:**
- `n8n-workflows/workflow-01-collect-and-curate.json` (ready-to-import)
- Cron-Trigger: täglich 06:00 CET
- RSS-Sources: Heise, Golem, MIT TR, Ars Technica, The Verge, Tagesschau, APA
- Web-Search via z-ai-web-dev-sdk
- LLM-Curation via z-ai-web-dev-sdk
- DB-Save via HTTP POST an `/api/ai-news/internal/ingest`
- Error-Handling + Retry-Logic
- README mit Credentials-Setup

**Akzeptanzkriterien:**
- [ ] Workflow lässt sich in n8n importieren ohne Fehler
- [ ] Cron konfiguriert auf 06:00 Europe/Vienna
- [ ] Alle Credentials via Platzhalter dokumentiert
- [ ] Test-Run (manuell) schreibt 5-10 Items + Summary in DB
- [ ] Error-Node vorhanden

**Validierung:**
- Dry-Run mit Mock-RSS
- Verifizierung in Prisma Studio

---

### Sprint 3 — n8n: LinkedIn Post Workflow
**Paket-Typ:** Backend (n8n)
**Aufwand:** 2-3h
**Abhängigkeit:** S2
**Status:** Pending

**Liefergegenstände:**
- `n8n-workflows/workflow-02-linkedin-post.json`
- Trigger: Webhook (aufgerufen von Workflow 1 nach erfolgreichem Save)
- Liest heutige Summary + Items via GET `/api/ai-news/today`
- Formatiert LinkedIn-Post (DE)
- Post via LinkedIn API (OAuth2 Credential)
- README mit LinkedIn-API-Setup

**Akzeptanzkriterien:**
- [ ] Workflow importiert ohne Fehler
- [ ] Post-Format entspricht Template (`templates/linkedin-post-template.md`)
- [ ] LinkedIn-API-Credential via Platzhalter
- [ ] Test-Run (dry) erzeugt korrekten Post-Text
- [ ] Error-Handling

---

### Sprint 4 — n8n: Newsletter Send Workflow
**Paket-Typ:** Backend (n8n)
**Aufwand:** 3-4h
**Abhängigkeit:** S2
**Status:** Pending

**Liefergegenstände:**
- `n8n-workflows/workflow-03-newsletter-send.json`
- Trigger: Webhook (von Workflow 1)
- Liest alle confirmed Subscriber (gruppiert nach Sprache + Frequenz)
- Für Daily: sofortiger Versand
- Für Weekly/Digest: Speicherung in Queue, Versand via separatem Cron
- HTML-Templates: `templates/newsletter-html-de.html`, `templates/newsletter-html-en.html`
- SMTP-Versand mit List-Unsubscribe-Header
- README mit SMTP-Setup

**Akzeptanzkriterien:**
- [ ] Workflow importiert ohne Fehler
- [ ] Subscriber-Query korrekt (nur confirmed, nicht unsubscribed)
- [ ] HTML-Template im Levcon-Design (Creme/Schwarz/Rot)
- [ ] List-Unsubscribe-Header korrekt (RFC 8058)
- [ ] Test-Versand an Test-Adresse erfolgreich
- [ ] `lastSentDate` wird aktualisiert

---

### Sprint 5 — Frontend: News-Panel
**Paket-Typ:** Frontend
**Aufwand:** 4-5h
**Abhängigkeit:** S1
**Status:** Pending

**Liefergegenstände:**
- Neues Panel "AI NEWS" in `LevconPage.tsx`
- Nav-Button "AI NEWS" (zwischen DATENSTRATEGIE und FAQ)
- `<AiNewsPanel>` Komponente
- `<AiNewsItem>` mit Aufklapp-Logik (Chevron + External-Link)
- Summary-Block oben
- Server-Component (lädt aus DB via Prisma)
- i18n-Strings in `de.json` / `en.json`
- Caching via `revalidate = 3600`

**Akzeptanzkriterien:**
- [ ] Panel erscheint in Navigation
- [ ] Aktuelle News werden server-gerendert angezeigt
- [ ] Aufklapp-Animation smooth (Chevron rotated)
- [ ] External-Link öffnet in neuem Tab (`rel="noopener noreferrer nofollow"`)
- [ ] Mobile: 1-spaltig, Desktop: optional 2-spaltig
- [ ] WCAG AA: Tastatur bedienbar, ARIA korrekt
- [ ] Lint: 0 Errors

**Validierung:**
- Browser-Check (Mobile + Desktop)
- Lighthouse-Check (Performance, Accessibility)

---

### Sprint 6 — Frontend: Signup-Formular + Double-Opt-In
**Paket-Typ:** Fullstack
**Aufwand:** 3-4h
**Abhängigkeit:** S1
**Status:** Pending

**Liefergegenstände:**
- `<AiNewsSignup>` Komponente im News-Panel
- API-Route: `POST /api/ai-news/subscribe`
- API-Route: `GET /api/ai-news/confirm?token=...`
- API-Route: `GET /api/ai-news/unsubscribe?token=...`
- Bestätigungs-Mail via SMTP (n8n oder Next.js API)
- Honeypot + Time-Check (wie bestehendes Kontaktformular)
- Rate-Limiting (Memory-Cache)
- i18n-Strings

**Akzeptanzkriterien:**
- [ ] Signup-Formular validiert E-Mail + Frequenz + Consent
- [ ] Honeypot fängt Bots ab
- [ ] Double-Opt-In-Mail wird innerhalb 5 Min verschickt
- [ ] Confirm-Link setzt `confirmedAt`
- [ ] Unsubscribe-Link setzt `unsubscribedAt`
- [ ] Tokens sind UUID4
- [ ] DSGVO: Keine IPs gespeichert

**Validierung:**
- E2E-Test via Agent-Browser
- Edge-Cases: leere E-Mail, Duplicate, abgelaufener Token

---

### Sprint 7 — Archiv + Polish + DSGVO-Texte
**Paket-Typ:** Both
**Aufwand:** 2-3h
**Abhängigkeit:** S5, S6
**Status:** Pending

**Liefergegenstände:**
- `<AiNewsArchive>` Accordion (kollabiert, vergangene Tage)
- API-Route: `GET /api/ai-news/archive?limit=30`
- DSGVO-Text-Ergänzung in `de.json` / `en.json` (Datenschutzerklärung)
- Newsletter-Datenschutz-Abschnitt
- Cleanup-Job-Doku (n8n-Workflow für Retention)
- Final Polish: Spacing, Animations, Kontraste

**Akzeptanzkriterien:**
- [ ] Archiv klappt auf, zeigt vergangene Tage
- [ ] Datenschutzerklärung erwähnt AI News + Newsletter
- [ ] Signup-Link zur Datenschutzerklärung funktioniert
- [ ] Alle Komponenten responsive
- [ ] Lighthouse: Accessibility ≥ 95

---

### Sprint 8 — VPS-Deployment & Smoke-Test
**Paket-Typ:** DevOps
**Aufwand:** 2-3h
**Abhängigkeit:** S2, S3, S4, S5, S6, S7
**Status:** Pending

**Liefergegenstände:**
- VPS-Setup-Doku finalisiert
- n8n-Workflows auf VPS importiert
- Credentials konfiguriert (Owner muss Credentials eintragen)
- Smoke-Test: Workflow manuell triggern, Newsletter testen
- Monitoring: Health-Check-Endpoint

**Akzeptanzkriterien:**
- [ ] n8n-Workflows aktiv auf VPS
- [ ] Cron triggert um 06:00 CET
- [ ] LinkedIn-Post erfolgreich (oder dokumentierter Fehler)
- [ ] Newsletter an Test-Verteiler erfolgreich
- [ ] Smoke-Test-Dokumentation

---

## 4. Qualitäts-Gates pro Sprint

Jeder Sprint MUSS folgende Gates durchlaufen ( dokumentiert in `TEST-RESULTS.md`):

### Gate 1: Code-Complete
- [ ] Alle Akzeptanzkriterien erfüllt
- [ ] Code-Review Self-Check abgeschlossen (CODE-REVIEW.md)
- [ ] Edge-Cases dokumentiert

### Gate 2: Lint & Build
- [ ] `bun run lint` — 0 Errors
- [ ] `bun run db:push` (bei Schema-Änderungen) — erfolgreich
- [ ] TypeScript: 0 Type-Errors

### Gate 3: Manuelle Validierung
- [ ] `bun run dev` — Server startet ohne Errors
- [ ] Dev-Log: keine Hydration-Warnings, keine 500er
- [ ] Agent-Browser: Haupt-User-Flow durchgespielt

### Gate 4: Doku-Update
- [ ] Sprint-Doku in `/sprints/` aktualisiert
- [ ] CODE-REVIEW.md aktualisiert
- [ ] TEST-RESULTS.md aktualisiert
- [ ] CONTEXT.md Status-Feld aktualisiert

### Gate 5: Commit & Push
- [ ] Commit-Message konform (`feat(ai-news): ...`)
- [ ] Push nach `main` (oder Feature-Branch mit PR)
- [ ] Owner-Benachrichtigung mit Status

---

## 5. Risiken & Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| LinkedIn-API-Ablehnung | Medium | Medium | Manueller Post als Fallback dokumentiert |
| RSS-Quellen blockieren n8n | Low | Low | User-Agent setzen, Rate-Limit respektieren |
| LLM-Halluzination bei Curation | Medium | High | Source-URL immer verlinkt, als "Zusammenfassung" gekennzeichnet |
| SQLite-Locks bei vielen Writes | Low | Medium | n8n schreibt nur 1x/Tag, OK |
| SMTP als Spam markiert | Medium | High | SPF/DKIM/DMARC konfigurieren, Fallback via externen Dienst |
| DSGVO-Fehler bei Double-Opt-In | Low | Critical | Standard-Pattern wie bestehendes Kontaktformular, rechtliche Prüfung empfohlen |

---

## 6. Definition of Done (DoD)

Ein Sprint gilt als "Done", wenn:

1. ✅ Alle Akzeptanzkriterien erfüllt
2. ✅ Alle 5 Quality-Gates durchlaufen
3. ✅ Code committed & gepusht
4. ✅ Dokumentation aktualisiert
5. ✅ Owner hat Status-Update erhalten
6. ✅ Keine bekannten Blocker

---

## 7. Estimation-Matrix (für zukünftige Sprints)

| Komplexität | Beispiele | Aufwand |
|---|---|---|
| Trivial | Textänderung, kleines CSS | < 1h |
| Simple | Neuer API-Endpunkt, kleines Component | 1-2h |
| Medium | Neues Panel mit DB-Anbindung | 2-4h |
| Complex | n8n-Workflow mit LLM + DB + Multi-Step | 4-6h |
| Critical | Sicherheitsrelevante Logik (Auth, Payment) | 6-8h + Review |

---

## 8. Sprint-Dokument-Template

Jede Sprint-Datei in `/sprints/` folgt diesem Template:

```markdown
# Sprint X — <Titel>

**Status:** Pending | In Progress | Done | Blocked
**Started:** YYYY-MM-DD
**Finished:** YYYY-MM-DD

## Ziel
<Was wird geliefert?>

## Akzeptanzkriterien
- [ ] ...

## Implementierung
1. ...
2. ...

## Validierungsergebnisse
- Lint: ...
- Build: ...
- Browser-Check: ...

## Code-Review
- Reviewer: <Agent-Name>
- Datum: YYYY-MM-DD
- Findings: ...

## Known Issues
- ...

## Nächste Schritte
- ...
```

---

## Sprint 14-15 — Newsletter Polish & Compliance (Juli 2026) ✅

### Sprint 14: Frontend + Archiv
- Sprachfilter default = Locale (DE/EN statt "Alle")
- Kategorie-Symbole ausgeblendet
- Translate-Link für beide Richtungen (DE→EN, EN→DE)
- Archiv: 3-stufige Hierarchie (Archiv → Monat → Tag)
- Archiv-Suche: filtert Editions + Items innerhalb von Editions

### Sprint 15: Newsletter + Bestätigungsmail
- Footer: Levcon.ai · Einstellungen · Datenschutz · Impressum
- Bestätigungsmail als Template ausgelagert (confirmation-html-de/en.html)
- Confirm-Seite statt /api/ URL (Sophos Fix)
- Abmeldung in Einstellungen (3-State UI: idle → confirming → success)
- Schriftfarbe #464644 (Website-konform)
- INTERNATIONAL Header: gleiche Schriftart wie "KI-News des Tages" Label
- Padding-Fixes (symmetrisch, 32px Summary)

### Workflow v5 (Juli 2026)
- 2 serielle Ollama-Läufe (DE dann EN) statt 1 Lauf mit 20 Items
- format: json_object (verhindert Early-Abort)
- Enrichment: LLM-Items mit Originaldaten anreichern
- HTML-Entity-Dekodierung im RSS-Fetch
- UTF-8 Encoding im RSS-Fetch

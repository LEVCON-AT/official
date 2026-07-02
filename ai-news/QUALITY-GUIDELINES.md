# Quality Guidelines — AI News Projekt

**Gültig für:** Alle Sprints, Agenten, Commits, Reviews
**Letzte Aktualisierung:** 2025-06-25

Diese Richtlinien sind **verbindlich**. Jeder Agent, der in diesem Projekt arbeitet, MUSS sie einhalten. Abweichungen sind explizit im Code-Review zu begründen.

---

## 1. Allgemeine Prinzipien

### 1.1 International Standards
- **W3C-Standards:** Semantic HTML5, ARIA 1.2, WCAG 2.1 AA
- **RFC-Konform:** HTTP-Statuscodes korrekt verwenden (200, 201, 400, 401, 403, 404, 429, 500)
- **ISO 8601:** Alle Datumsangaben in APIs als `YYYY-MM-DD` oder ISO-8601-DateTime
- **RFC 5322:** E-Mail-Validierung
- **JSON:API** Konventionen für REST-Endpoints

### 1.2 Naming Conventions
- **Dateien:** `kebab-case.ts` (z.B. `news-item-card.tsx`)
- **Komponenten:** `PascalCase` (z.B. `NewsItemCard`)
- **Variablen/Funktionen:** `camelCase`
- **Konstanten:** `SCREAMING_SNAKE_CASE`
- **DB-Tabellen:** `PascalCase` Model, `snake_case` Spalten via Prisma `@map`
- **API-Routen:** `/api/ai-news/...` (kebab-case)

### 1.3 Sprache
- Code-Kommentare: Englisch
- Variablen/Funktionen: Englisch
- UI-Texte: via i18n (de.json/en.json), keine Hardcodierungen
- Doku-Dateien: Deutsch (für Owner), englische Abschnitte explizit markieren

---

## 2. Code-Standards

### 2.1 TypeScript
- **Strict Mode** aktiviert (`strict: true` in tsconfig)
- Kein `any` — wenn unvermeidbar, mit Kommentar begründen
- Interfaces für API-Payloads, Types für interne Datenstrukturen
- `unknown` statt `any` bei untrusted Input, dann Type-Guard
- Async-Funktionen: immer `try/catch` mit spezifischer Fehlerbehandlung

### 2.2 React / Next.js 16
- **Server Components** bevorzugen, `'use client'` nur wenn nötig
- **App Router** only (kein Pages Router)
- **Streaming/Suspense** für langsame DB-Queries nutzen
- **Metadata-API** für SEO (kein manuelles `<head>`)
- Kein `dangerouslySetInnerHTML` außer für trusted JSON-LD

### 2.3 API Routes
- Input-Validation mit **Zod** (oder Type-Box)
- Rate-Limiting für öffentliche Endpoints (Memory-Cache oder Upstash)
- Strukturiertes Error-Handling:
  ```ts
  return NextResponse.json({ error: 'Invalid input', details: [...] }, { status: 400 });
  ```
- HTTP-Methoden korrekt: GET (idempotent), POST (creation), PATCH (partial update), DELETE
- CORS nur bei Bedarf öffnen, sonst Same-Origin

### 2.4 Prisma / SQLite
- Migrationen immer über `bun run db:push` (SQLite-Entwicklung)
- Schema-Änderungen: immer `schema.prisma` bearbeiten, dann push
- Indizes auf häufig gefilterte Spalten (`date`, `email`, `language`)
- Kein N+1 — immer `include` oder `select` verwenden
- Transaktionen für Multi-Write-Operationen

### 2.5 Security
- **Secrets** nie im Code, immer via `.env` (Production: VPS-Env)
- **API-Keys** als Platzhalter in Code (`process.env.X ?? 'PLACEHOLDER'`)
- **SQL-Injection:** nur Prisma-Parameterized-Queries
- **XSS:** React escapet by default, kein `dangerouslySetInnerHTML` für User-Content
- **CSRF:** SameSite=Strict Cookies, Origin-Check bei POST
- **Spam:** Honeypot + Zeit-Check (wie bestehendes Kontaktformular)

---

## 3. DSGVO / Privacy

### 3.1 Grundsätze
- **Datenminimierung:** Nur sammeln, was notwendig ist
- **Zweckbindung:** Jede Datenverarbeitung hat dokumentierten Zweck
- **Transparenz:** Datenschutzerklärung erweitern bei jedem neuen Verarbeitungsschritt
- **Löschpflicht:** Subscriber können jederzeit löschen (Recht auf Vergessenwerden)

### 3.2 Newsletter-spezifisch
- **Double-Opt-In** zwingend (Token mit Ablauf nach 7 Tagen)
- **Bestätigungs-Mail** innerhalb 5 Minuten nach Signup
- **Abmeldelink** in jeder Mail (One-Click-Unsubscribe nach RFC 8058)
- **Speicherdauer:** Subscriber-Daten bis Abmeldung + 30 Tage für Audit, dann hard delete
- **Keine Tracker** in Mails (keine Pixel, keine getrackten Links)
- **Protokollierung:** Nur `email` + `confirmStatus` + `createdAt`, keine IPs

### 3.3 AI News Content
- Artikel-Links = externe Verlinkungen (`rel="noopener noreferrer nofollow"`)
- Thumbnails: nur wenn frei verwendbar (CC, Presse-Fotos mit Quelle) oder weglassen
- Zusammenfassungen: als eigenständiger redaktioneller Text, nicht als Zitat

---

## 4. Frontend / UI-Standards

### 4.1 Design-System (Levcon-treu)
- **Farben:** Nur `--lc-bg`, `--lc-ink`, `--lc-red`, `--lc-rule`, `--lc-muted`
- **Schriften:** Cormorant Garamond (Headlines), Inter (Body) — via next/font
- **Spacing:** clamp()-basiert wie bestehend
- **Mobile-First:** 375px → 768px → 1280px Breakpoints

### 4.2 Accessibility (WCAG 2.1 AA)
- Semantische HTML-Elemente (`<article>`, `<time>`, `<nav>`)
- `aria-label` für interaktive Elemente ohne sichtbaren Text
- `aria-expanded` für Aufklapp-Elemente
- Tastaturnavigation: Tab-Reihenfolge logisch, Focus-Styles sichtbar
- Screen-Reader: `sr-only` für visuelle Labels, wenn nötig
- Kontrast: min 4.5:1 für Text (via Opacity-Token geprüft)
- Touch-Targets: min 44×44px

### 4.3 Performance
- **Bilder:** `next/image` mit `width`/`height`, `loading="lazy"` für Thumbnails
- **Bundle-Size:** kritisch halten, kein unnötiges JS
- **DB-Queries:** Server-Component, kein Client-Fetch für initiale News-Liste
- **Caching:** News des aktuellen Tages via `revalidate = 3600` (1h)

### 4.4 Responsive
- Mobile ≤620px: 1-spaltig, Aufklapp-Animation, Touch-Targets ≥44px
- Desktop ≥1024px: 2-spaltige News-Liste optional, sonst 1-spaltig mit größeren Abständen

---

## 5. n8n Workflow-Standards

### 5.1 Struktur
- Jeder Workflow hat **einen** Cron-Trigger
- Klare Node-Namen (kein "HTTP Request 1" — stattdessen "Fetch RSS Feeds")
- Credentials via n8n-Credential-Store, nicht als Klartext
- Kommentare/Notes an komplexen Nodes

### 5.2 Error-Handling
- Jeder kritische Node hat `continueOnFail: false` (außer bewusst ignoriert)
- Error-Trigger-Workflow für E-Mail-Benachrichtigung an Owner
- Retry-Logic für externe APIs (max 3 Versuche, exponential backoff)

### 5.3 Platzhalter
- API-Keys als `{{ $env.KEY_NAME }}` in n8n-Expressions
- Im Import-JSON: `"credentials": { ... }` mit Platzhalter-IDs
- README.md pro Workflow dokumentiert benötigte Credentials

### 5.4 Export-Format
- Workflows als JSON (n8n native export)
- Dateiname: `workflow-XX-name.json`
- README.md mit: Zweck, Cron, Credentials, Env-Vars

---

## 6. Git / Commit-Standards

### 6.1 Branch-Strategie
- `main` = Production-ready
- Feature-Branches: `feat/ai-news-<sprint>` (z.B. `feat/ai-news-db-schema`)
- Nach Sprint: PR / Fast-Forward nach `main`

### 6.2 Commit-Message-Format (Conventional Commits)
```
<type>(ai-news): <kurzbeschreibung>

<optionale detallierung>

<footer>
```

**Typen:**
- `feat` — Neue Funktion
- `fix` — Bugfix
- `docs` — Doku-Änderung
- `refactor` — Code-Umstrukturierung ohne Funktionsänderung
- `test` — Test-Code
- `chore` — Build, Config, Maintenance

**Beispiele:**
```
feat(ai-news): add Prisma schema for news items and subscribers
fix(ai-news): correct timezone handling in cron trigger
docs(ai-news): add LinkedIn API setup guide
```

### 6.3 Pre-Commit-Checks
Vor jedem Commit:
1. `bun run lint` — 0 Errors (Warnings dokumentieren)
2. `bun run db:push` (bei Schema-Änderungen) — erfolgreich
3. Manuelles Sanity-Check im Browser (bei UI-Änderungen)
4. Commit-Message konform

---

## 7. Test- & Validierungs-Strategie

### 7.1 Tests (zwingend)
- **Unit-Tests** für Utilities (Date-Formatting, E-Mail-Validierung)
- **Integration-Tests** für API-Routes (z.B. signup → confirm → unsubscribe)
- **E2E-Tests** (optional): Signup-Flow via Agent-Browser
- **Test-Files:** `*.test.ts` neben Source, Suffix `.test.ts`

### 7.2 Manuelle Validierung (nach jedem Sprint)
1. `bun run lint` — 0 Errors
2. `bun run dev` — Server startet ohne Errors
3. Dev-Log checken: keine Hydration-Warnings, keine 500er
4. Agent-Browser: Haupt-User-Flow durchspielen
5. Screenshot vor/nach für Doku

### 7.3 Code-Review (Self-Review)
Nach Implementierung, vor Commit:
- [ ] Code liest sich wie geschrieben von einem Senior-Entwickler
- [ ] Keine toten Code-Pfade
- [ ] Keine `console.log` außer in Dev-Only-Code
- [ ] Fehlermeldungen sind verständlich und actionabel
- [ ] Edge-Cases dokumentiert oder behandelt (leere Listen, null, undefined)
- [ ] Accessibility geprüft (Tab, Screen-Reader)
- [ ] DSGVO-Konformität geprüft (bei personenbezogenen Daten)

### 7.4 Dokumentation der Validierung
In `TEST-RESULTS.md` pro Sprint:
```markdown
## Sprint X — Validation Results
- Lint: ✅ 0 errors, 0 warnings
- Build: ✅ Successful
- Browser-Check: ✅ Signup form submit works
- Edge-Cases tested: empty email, invalid format, duplicate signup
- Known issues: none
```

---

## 8. Dokumentations-Pflichten

### 8.1 Code-Kommentare
- Nur bei nicht-trivialem Code (warum, nicht was)
- `// TODO:` mit Owner-Initialen und Datum
- `// FIXME:` mit Begründung

### 8.2 Doku-Dateien
- Pro Sprint eine Sprint-Doku in `/sprints/`
- Code-Review-Log fortlaufend in `CODE-REVIEW.md`
- Test-Ergebnisse in `TEST-RESULTS.md`
- Archdecision Records (ADR) bei Architektur-Entscheidungen in `/docs/adr/`

---

## 9. Environment & Secrets

### 9.1 .env-Platzhalter
- Vorlage in `ENV-TEMPLATE.md`
- Echte Werte NIE committen
- `.gitignore` enthält `.env`, `.env.local`, `.env.production`

### 9.2 Production (VPS)
- Secrets via systemd-Environment-File oder Docker-Secrets
- n8n-Credentials via Credential-Store (verschlüsselt)
- DB-Backups täglich (cron + sqlite3 `.dump`)

---

## 10. Wartung & Monitoring

### 10.1 Logging
- Strukturiertes Logging (JSON)
- Loglevel: ERROR, WARN, INFO, DEBUG (Production: INFO)
- Keine sensiblen Daten in Logs (E-Mails maskieren)

### 10.2 Health-Checks
- `/api/health` Endpoint
- n8n-Workflow-Status via n8n-API
- Alert bei 3 aufeinanderfolgenden Workflow-Fehlern

### 10.3 Backups
- SQLite-DB: tägliches Dump auf VPS, wöchentlich offsite
- n8n-Workflows: versioniert im Git-Repo
- Newsletter-Templates: versioniert im Git-Repo

---

## 11. Owner-Communication

- Nach jedem Sprint: Status-Update mit Ergebnissen
- Vor jedem Sprint: Bestätigung der Akzeptanzkriterien
- Bei Blockern: sofortige Meldung mit Lösungsvorschlägen
- Keine eigenen Entscheidungen bei Architektur-Trade-offs ohne Owner-Freigabe

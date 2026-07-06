# Levcon.ai — Project Context (Master Document)

**Stand:** 2025-07-07
**Status:** Production Live (Levcon.ai), Local LLM (Ollama) erfolgreich angebunden
**Owner:** Enric-Bernard Sep-Albi (Levcon.ai)

Dieses Dokument dient als zentrale Anlaufstelle für KI-Sessions und Entwickler, um den Projektstatus, die Architektur und offene Aufgaben zu verstehen.

---

## 1. Projektüberblick

Levcon.ai ist die Website für Enric-Bernard Sep-Albi (KI-Trainer und Organisationsentwickler aus Wien). Die Website ist eine minimalistische, aber technisch hochmoderne Next.js-Anwendung. Das Hauptfeature ist der Bereich "AI News", der täglich KI-News kuratiert — **vollständig automatisiert durch ein lokales LLM auf dem VPS**.

### 1.1 Technologie-Stack
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, next-intl (DE/EN)
- **Backend:** Next.js API Routes, Prisma ORM, SQLite
- **Infrastruktur:** Ubuntu VPS (87.106.25.91), nginx (Reverse Proxy + SSL), systemd, Docker
- **Automation:** n8n (Docker, Host-Network), Ollama (Qwen 2.5 1.5B), SearXNG (Meta-Suche)
- **CI/CD:** GitHub Actions (Auto-Deploy bei Push auf `main`)

### 1.2 Domains & Routing
- `levcon.ai` / `www.levcon.ai` → Next.js App (Port 3002)
- `engine.levcon.at` → n8n UI (Port 5678, über Host-Network)
- *( Weitere Sites auf dem VPS: levcon.at, PDF-Server, etc. )*

---

## 2. Architektur & lokale KI

Die KI-News werden komplett auf dem VPS generiert, ohne Cloud-LLM-APIs (DSGVO-maximal).

```
n8n Workflow (06:00 Europe/Vienna)
  ├── 1. RSS Feeds abrufen (Heise, MIT, Ars Technica, etc.)
  ├── 2. SearXNG Web-Suche (localhost:8888)
  ├── 3. Merge & Deduplikation
  ├── 4. Code-Node: "Build Ollama Request" (Formatiert Prompt + HTTP Call)
  │      └── Ollama API (localhost:11434)
  │          └── Modell: qwen2.5:1.5b
  ├── 5. Code-Node: "Parse LLM JSON" (Fehler-tolerantes Parsing)
  └── 6. HTTP POST an /api/ai-news/internal/ingest (Next.js API)
         └── Speichert in SQLite via Prisma
```

**Wichtige technische Details (Lesson Learned):**
- n8n läuft im Docker `--network host` Mode, damit `127.0.0.1` auf den VPS-Host zeigt.
- Der Ollama HTTP-Aufruf erfolgt direkt in einem n8n Code-Node via `this.helpers.httpRequest`, da n8n's UI-Expression-Parser Probleme mit JSON-Bodies hatte.
- Die Next.js App berechnet "Heute" in der Zeitzone `Europe/Vienna`, da der Server in UTC läuft, n8n aber in Wiener Zeit speichert.

---

## 3. Erledigte Aufgaben (Sprints)

| Sprint | Beschreibung | Status |
|---|---|---|
| **S1** | DB-Schema & Migration (Prisma/SQLite) | ✅ Done |
| **S5** | Frontend AI News Panel (Liste, Aufklappen, Archiv) | ✅ Done |
| **S6** | Newsletter Signup + Double-Opt-In API | ✅ Done |
| **S7** | DSGVO-Texte, Polish, Reveal-Animation | ✅ Done |
| **S8** | VPS Deployment (nginx, SSL, systemd, GitHub Actions) | ✅ Done |
| **Local LLM** | Ollama + SearXNG Setup + n8n Workflow Anpassung | ✅ Done |

---

## 4. Offene Aufgaben (Backlog / Sprint-Planung)

### 4.1 Quality Assurance & Infrastruktur
- [ ] **Final Code Review:** Sämtlichen Code (Next.js + n8n Workflows) auf Best Practices, Sauberkeit und Kommentare prüfen.
- [ ] **HTML-Code Erscheinungsbild:** Manuelle Design-QA im Browser (Desktop & Mobile). Fokus auf Typografie, Abstände, Aufklapp-Animationen.
- [ ] **Staging-Infrastruktur:** Git-Branch-Strategie definieren. Staging-Subdomain (z.B. `staging.levcon.ai`) einrichten. Auto-Deploy auf Staging bei Push auf `develop` Branch.
- [ ] **Backup-Strategie:** Cronjob für SQLite DB-Backups prüfen. GitHub Repo als Code-Backup. n8n Workflows als JSON im Repo versionieren.

### 4.2 Automation & Integrationen
- [ ] **n8n Cron aktivieren:** Local-LLM Workflow in n8n aktivieren (Toggle auf "Active"), damit er täglich um 06:00 läuft.
- [ ] **LinkedIn Integration (Sprint 3):** LinkedIn App erstellen, OAuth2 in n8n einrichten, Workflow 02 testen.
- [ ] **Newsletter Versand (Sprint 4):** IONOS SMTP Credentials in n8n einrichten, Workflow 03 testen. Test-Subscriber anlegen.
- [ ] **Cleanup-Job:** n8n Workflow für tägliches Cleanup (7 Tage unconfirmed, 30 Tage unsubscribed) aktivieren.

### 4.3 Content & Feinschliff
- [ ] **SearXNG Query Optimierung:** Bessere Such-Queries für relevantere Results (z.B. "artificial intelligence news today").
- [ ] **Quellen-Diversifizierung:** Mehr internationale RSS-Feeds (The Verge, TechCrunch) aktiv prüfen.
- [ ] **z-ai Fallback:** z-ai Workflow als Backup aktiv halten, falls Qwen scheitert.

---

## 5. Zugriff & Credentials

- **VPS:** `ssh root@87.106.25.91`
- **GitHub Repo:** https://github.com/LEVCON-AT/official
- **n8n UI:** https://engine.levcon.at (Login erforderlich)
- **Next.js `.env`:** `/var/www/levcon/.env` (enthält `DATABASE_URL`, `LEVCON_INTERNAL_API_KEY`, SMTP Settings)

### API Keys / Secrets
- `LEVCON_INTERNAL_API_KEY`: Schützt `/api/ai-news/internal/*`. Liegt in `/var/www/levcon/.env` und als Header Auth Credential in n8n.
- `SMTP_PASS`: IONOS Passwort für `admin@levcon.at`. Liegt in `.env` (für Next.js Kontaktformular), muss noch in n8n für Newsletter eingetragen werden.

---

## 6. Bekannte Issues & Technische Schulden

1. **n8n Code-Node Workaround:** Der Ollama-Request muss via `this.helpers.httpRequest` in einem Code-Node ausgeführt werden, weil der Standard HTTP-Request-Node von n8n Probleme mit der JSON-Body-Generierung via Expressions hatte.
2. **SearXNG Rate-Limits:** Startpage und Brave blockieren oft (CAPTCHA). Die Haupt-Quellen sind Google und DuckDuckGo.
3. **Zeitzonen:** Next.js fragt die DB mit `Europe/Vienna` Logik ab, um mit n8n synchron zu sein.
4. **RAM-Knappheit:** Der VPS hat 3.8GB RAM. Ollama benötigt ~1.2GB. Supabase (Matrix) wurde deinstalliert, um RAM freizugeben.

---

## 7. Referenz-Dokumente im Repo

- `ai-news/docs/LOCAL-LLM-SETUP.md` — Installationsanleitung für Ollama + SearXNG
- `ai-news/n8n-workflows/` — JSON-Dateien für n8n (Local LLM, LinkedIn, Newsletter)
- `deploy/DEPLOYMENT.md` — Anleitung für VPS-Setup und GitHub Actions
- `ai-news/QUALITY-GUIDELINES.md` — Coding-Standards

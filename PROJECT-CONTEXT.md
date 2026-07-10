# Levcon.ai — Project Context (Master Document)

**Stand:** Juli 2026
**Status:** Production Live (Levcon.ai), Local LLM (Qwen3.5:2b via Ollama), Newsletter aktiv
**Owner:** Enric-Bernard Sep-Albi (Levcon.ai)

Dieses Dokument dient als zentrale Anlaufstelle für KI-Sessions und Entwickler, um den Projektstatus, die Architektur und offene Aufgaben zu verstehen.

---

## 1. Projektüberblick

Levcon.ai ist die Website für Enric-Bernard Sep-Albi (KI-Trainer und Organisationsentwickler aus Wien). Die Website ist eine minimalistische, aber technisch hochmoderne Next.js-Anwendung. Das Hauptfeature ist der Bereich "AI News", der täglich KI-News kuratiert — **vollständig automatisiert durch ein lokales LLM auf dem VPS**.

### 1.1 Technologie-Stack
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, next-intl (DE/EN)
- **Backend:** Next.js API Routes, Prisma ORM, SQLite
- **Infrastruktur:** Ubuntu VPS (87.106.25.91), nginx (Reverse Proxy + SSL), systemd, Docker
- **Automation:** n8n (Docker, Host-Network), Ollama (Qwen3.5:2b), SearXNG (Meta-Suche)
- **CI/CD:** GitHub Actions (Auto-Deploy bei Push auf `main`)

### 1.2 Domains & Routing
- `levcon.ai` / `www.levcon.ai` → Next.js App (Port 3002)
- `engine.levcon.at` → n8n UI (Port 5678, über Host-Network)

---

## 2. Architektur & lokale KI

Die KI-News werden komplett auf dem VPS generiert, ohne Cloud-LLM-APIs (DSGVO-maximal).

```
n8n Workflow 01 (06:00 Europe/Vienna)
  ├── Fetch All RSS (35 Feeds, max 30/Feed, UTF-8, HTML-Entities dekodiert)
  ├── Dedupe by URL
  ├── Score & Rank (6-Faktor-Scoring + Semantic Dedup + Source-Diversity-Cap)
  │   └── 2-Bucket Quota: 10 DE + 10 EN (max 2 pro Quelle pro Sprache)
  ├── Build Ollama Request (2 SERIELLE Läufe: DE dann EN)
  │   └── Ollama API (localhost:11434, Qwen3.5:2b)
  │       └── format: "json_object", num_predict: 6144
  │       └── Headline-Übersetzung: headlineDe + headlineEn für jedes Item
  │       └── Enrichment: LLM-Items mit Originaldaten anreichern
  ├── POST /api/ai-news/internal/ingest → SQLite via Prisma
  └── Trigger Workflow 02 (LinkedIn) + Workflow 03 (Newsletter)
```

**Wichtige technische Details:**
- n8n läuft im Docker `--network host` Mode, damit `127.0.0.1` auf den VPS-Host zeigt.
- 2 serielle Ollama-Läufe (DE + EN) entlasten CPU und vermeiden Ermüdungseffekt bei Qwen3.5:2b.
- `format: "json_object"` in Ollama erzwingt valides JSON (verhindert Early-Abort).
- Enrichment-Logik matcht LLM-Output mit Original-Input (verhindert fehlende Felder).
- Die Next.js App berechnet "Heute" in der Zeitzone `Europe/Vienna`.

---

## 3. Erledigte Aufgaben (Sprints)

| Sprint | Beschreibung | Status |
|---|---|---|
| **S1** | DB-Schema & Migration (Prisma/SQLite) | ✅ Done |
| **S5** | Frontend AI News Panel (Liste, Aufklappen, Archiv) | ✅ Done |
| **S6** | Newsletter Signup + Double-Opt-In API | ✅ Done |
| **S7** | DSGVO-Texte, Polish, Reveal-Animation | ✅ Done |
| **S8** | VPS Deployment (nginx, SSL, systemd, GitHub Actions) | ✅ Done |
| **S9** | Local LLM (Ollama Qwen3.5:2b + SearXNG) | ✅ Done |
| **S10** | Internationale RSS-Quellen (35 Feeds, DE/EN/ZH/JA/FR) | ✅ Done |
| **S12** | Newsletter Bulk-Send mit Sprach-Filterung | ✅ Done |
| **S13** | SEO-Routen, Panel-Navigation, Middleware-Fix | ✅ Done |
| **S14** | Frontend: locale-default Filter, Translate-Links, Archiv 3-stufig | ✅ Done |
| **S14b+c** | Newsletter: 2 Blöcke (DACH+International), vereinfachter Versand | ✅ Done |
| **S15a** | Footer: Impressum-Link, Bestätigungsmail-Template | ✅ Done |
| **S15b** | INTERNATIONAL Header elegant (gleiche Schriftart wie KI-News Label) | ✅ Done |
| **S15c** | Confirm-Seite statt /api/ URL (Sophos Fix) + Template-basierte Mails | ✅ Done |
| **S15d** | Abmeldung in Einstellungen (3-State UI) | ✅ Done |
| **S15e** | Schriftfarbe #464644 (Website-konform) + Padding-Fixes | ✅ Done |

---

## 4. Offene Aufgaben (Backlog)

### 4.1 Quality Assurance & Infrastruktur
- [ ] **Staging-Infrastruktur:** Git-Branch-Strategie definieren. Staging-Subdomain einrichten.
- [ ] **Backup-Strategie:** Cronjob für SQLite DB-Backups prüfen.
- [ ] **DNS-Records:** SPF, DKIM, DMARC für levcon.ai prüfen (reduziert Spam-Scoring).

### 4.2 Automation & Integrationen
- [ ] **LinkedIn Integration:** LinkedIn App erstellen, OAuth2 in n8n einrichten, Workflow 02 testen.
- [ ] **Model-Upgrade:** Qwen3.5:7b statt 2b (bessere JSON-Qualität, Sprint 9 war als Upgrade geplant).
- [ ] **INTL-Revival:** Internationalen Bucket (zh, ja, fr) wieder aktivieren falls gewünscht.

### 4.3 Content & Feinschliff
- [ ] **Quellen-Tuning:** Source-Weights basierend auf Score-Distribution-Logs anpassen.
- [ ] **SearXNG Query Optimierung:** Bessere Such-Queries für relevantere Results.

---

## 5. Zugriff & Credentials

- **VPS:** `ssh root@87.106.25.91`
- **GitHub Repo:** https://github.com/LEVCON-AT/official
- **n8n UI:** https://engine.levcon.at (Login erforderlich)
- **Next.js `.env`:** `/var/www/levcon/.env`

### API Keys / Secrets
- `LEVCON_INTERNAL_API_KEY`: Schützt `/api/ai-news/internal/*`. In `.env` und n8n Credential Store.
- `SMTP_PASS`: IONOS Passwort für `admin@levcon.at`. In `.env` und n8n Credentials.

---

## 6. Bekannte Issues

1. **Qwen3.5:2b Ermüdungseffekt:** Bei >15 Items pro Run kann Qualität der letzten Items nachlassen. Gelöst durch 2 serielle Läufe à 10 Items.
2. **Sophos Spam-Filter:** `/api/` URLs mit UUID-Token triggern Warnungen. Gelöst durch `/confirm` Server-Component (kein `/api/` Pfad).
3. **n8n Code-Node $env:** Code-Nodes haben keinen Zugriff auf `$env` (Sicherheitsfeature). URLs/Keys werden hardcodiert oder aus n8n Credentials geholt.
4. **Zeitzonen:** Next.js fragt die DB mit `Europe/Vienna` Logik ab, um mit n8n synchron zu sein.

---

## 7. Referenz-Dokumente im Repo

- `ai-news/n8n-workflows/` — 4 JSON-Workflows (Source of Truth, aktiv in n8n)
- `ai-news/n8n-workflows/code-nodes-refined/` — Code-Node-Inhalte als .js-Dateien (Referenz)
- `ai-news/templates/` — HTML-Templates für Newsletter + Bestätigungsmail
- `ai-news/QUALITY-GUIDELINES.md` — Coding-Standards (verbindlich)
- `ai-news/ARCHITECTURE.md` — Detaillierte Architektur-Doku
- `deploy/DEPLOYMENT.md` — Anleitung für VPS-Setup und GitHub Actions

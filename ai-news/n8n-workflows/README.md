# n8n Workflows — Levcon AI News

**Stand:** Juli 2026
**Status:** Alle 4 Workflows sind `active: true` (produktiv auf VPS)

Diese JSON-Dateien sind exportierte n8n-Workflows und stellen die **Source of Truth** dar. Die Code-Nodes in `code-nodes-refined/` dienen als Referenz für die Code-Node-Inhalte.

## Workflows

| Datei | Name | Cron | Zweck |
|-------|------|------|-------|
| `workflow-01-collect-and-curate.json` | AI News — 01 Collect & Curate | 06:00 Europe/Vienna | RSS fetchen, Score & Rank (10 DE + 10 EN), 2 serielle Ollama-Läufe, Ingest |
| `workflow-02-linkedin-post.json` | AI News — 02 LinkedIn Post | Webhook | Heute-News abholen, LinkedIn-Post formatieren, posten |
| `workflow-03-newsletter-send.json` | AI News — 03 Newsletter Send | Daily Webhook + Weekly + Digest | Tagesnews an Subscriber senden (DE/EN, 2 Blöcke: DACH + International) |
| `workflow-04-cleanup.json` | AI News — Cleanup (Daily) | Täglich | Unconfirmed (7 Tage) und Unsubscribed (30 Tage) löschen |

## Code-Nodes Referenz

Die Code-Node-Inhalte der Workflows sind in `code-nodes-refined/` als separate `.js`-Dateien abgelegt für bessere Wartbarkeit und Versionierung:

| Datei | Workflow | Node |
|-------|----------|------|
| `01-fetch-all-rss.code.js` | 01 | Fetch All RSS |
| `02-score-and-rank.code.js` | 01 | Score & Rank |
| `03-build-ollama-request.code.js` | 01 | Build Ollama Request (2 serielle Läufe) |
| `04-render-newsletter.code.js` | 03 | Render Newsletter HTML |
| `05-update-subscriber-last-sent.code.js` | 03 | Update Subscriber Last Sent |

**WICHTIG:** Bei Änderungen an Code-Nodes: zuerst die `.js`-Datei in `code-nodes-refined/` aktualisieren, dann den Code in n8n kopieren, testen, und den Workflow-Export als JSON zurück ins Repo committen.

## Pipeline-Übersicht (v5)

```
Workflow 01 (06:00 Vienna):
  Schedule Trigger
    → Fetch All RSS (35 Feeds, max 30/Feed, UTF-8, HTML-Entities dekodiert)
    → Dedupe by URL
    → Score & Rank (6-Faktor-Scoring + Semantic Dedup + 2-Bucket Quota: 10 DE + 10 EN)
    → Build Ollama Request (2 serielle Läufe: DE dann EN, format=json_object)
    → POST /api/ai-news/internal/ingest
    → Trigger Workflow 02 (LinkedIn) + Workflow 03 (Newsletter)

Workflow 03 (Newsletter):
  Trigger (Daily Webhook / Weekly Cron / Digest Cron)
    → Fetch Today News
    → Fetch Subscribers
    → Render Newsletter HTML (2 Blöcke: DACH zuerst, International danach)
    → Send Email (SMTP)
    → Update Subscriber Last Sent
```

## Credentials (in n8n Credential Store)

- **SMTP Levcon** — IONOS SMTP für Newsletter-Versand
- **Levcon Internal API** — X-Levcon-Api-Key Header Auth für /api/ai-news/internal/*
- **LinkedIn Levcon** — OAuth2 für LinkedIn Posts (falls aktiviert)

## Environment Variables (VPS .env)

```env
LEVCON_INTERNAL_API_KEY=<key>
NEXT_PUBLIC_SITE_URL=https://levcon.ai
SMTP_HOST=smtp.ionos.at
SMTP_PORT=587
SMTP_USER=admin@levcon.at
SMTP_PASS=<password>
SMTP_FROM="Levcon AI News" <admin@levcon.at>
SMTP_REPLY_TO=hello@levcon.ai
```

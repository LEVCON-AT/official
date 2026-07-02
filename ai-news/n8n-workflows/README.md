# n8n Workflows — AI News

**Status:** Templates v1.0 (ready to import, mit Platzhaltern)
**Last Updated:** 2025-06-25

---

## Übersicht

| # | Datei | Zweck | Cron |
|---|---|---|---|
| 01 | `workflow-01-collect-and-curate.json` | RSS + Web-Search sammeln, LLM kuratieren, in DB speichern, Webhooks an 02+03 | Täglich 06:00 CET |
| 02 | `workflow-02-linkedin-post.json` | Daily AI Update auf LinkedIn posten (DE) | Via Webhook aus 01 |
| 03 | `workflow-03-newsletter-send.json` | Newsletter an alle Subscriber (nach Sprache & Frequenz) | Via Webhook aus 01 + Extra-Cron für Weekly/Digest |

---

## Import-Anleitung

1. n8n-UI öffnen (z.B. https://n8n.levcon.ai)
2. Workflows → "Import from File"
3. JSON-Datei hochladen
4. Workflow öffnen — Credentials sind als Platzhalter hinterlegt
5. Jeder Credential-Node: Klicken → Credential zuweisen (vorher in Credentials anlegen)
6. Workflow speichern
7. Aktivieren (Toggle oben rechts)

---

## Erforderliche Credentials

Vor dem Import folgende Credentials in n8n anlegen (Settings → Credentials → Add):

### 1. `Levcon Internal API` (Header Auth)
- **Typ:** Header Auth
- **Name:** `Levcon Internal API`
- **Header Name:** `X-Levcon-Api-Key`
- **Value:** `<LEVCON_INTERNAL_API_KEY>` (aus .env)

### 2. `z-ai LLM` (HTTP Header Auth)
- **Typ:** HTTP Header Auth (oder Generic Credential)
- **Name:** `z-ai LLM`
- **Header Name:** `Authorization`
- **Value:** `Bearer <ZAI_API_KEY>`

### 3. `LinkedIn Levcon` (OAuth2 API)
- **Typ:** LinkedIn OAuth2 API
- **Name:** `LinkedIn Levcon`
- **Client ID:** `<LINKEDIN_CLIENT_ID>`
- **Client Secret:** `<LINKEDIN_CLIENT_SECRET>`
- **Scopes:** `w_member_social` (für Post als Person) oder `w_organization_social` (als Organization)
- **Redirect URI:** `https://n8n.levcon.ai/rest/oauth2-credential/callback`

### 4. `SMTP Levcon` (SMTP)
- **Typ:** SMTP
- **Name:** `SMTP Levcon`
- **Host:** `<SMTP_HOST>` (z.B. smtp.mailgun.org)
- **Port:** 587
- **User:** `<SMTP_USER>`
- **Password:** `<SMTP_PASS>`
- **TLS:** eingeschaltet

---

## Erforderliche Environment-Variab in n8n

Diese müssen in der n8n-Docker-Umgebung gesetzt sein (siehe VPS-SETUP.md):

```
LEVCON_API_BASE=https://levcon.ai
LEVCON_INTERNAL_API_KEY=<gleicher-wie-nextjs>
ZAI_API_KEY=<dein-z-ai-key>
ZAI_API_ENDPOINT=https://api.z.ai/api/paas/v4
ALERT_EMAIL=ops@levcon.ai
```

---

## Workflow-Abhängigkeiten

```
[01: Collect & Curate]
        │
        ├── Webhook → [02: LinkedIn Post]
        │
        └── Webhook → [03: Newsletter Send (Daily)]
                          │
                          └── Cron (Sonntags 08:00) → [03: Newsletter Send (Weekly)]
                          │
                          └── Cron (1. des Monats 08:00) → [03: Newsletter Send (Digest)]
```

Workflow 02 und 03 sind unabhängig voneinander — wenn LinkedIn fehlschlägt, bekommt der Newsletter trotzdem seine News.

---

## Test-Modus

Jeder Workflow hat einen manuellen Trigger (Trigger Node "On clicking 'Execute'"):
1. Workflow öffnen
2. "Execute"-Button klicken
3. Run-Logs prüfen

Für Workflow 01: Test-Run schreibt in DB. Vor Test: `lastTestRun=true` als Query-Parameter, um Test-Daten zu markieren.

---

## Fehlerbehandlung

- Jeder Workflow hat Error-Trigger am Ende
- Bei Fehler: Mail an `ALERT_EMAIL`
- Error-Workflow wird automatisch aktiviert nach Import

---

## Workflow-Anpassungen

Häufige Anpassungen nach Import:

### RSS-Quellen ändern
- Workflow 01 → Node "Fetch RSS Feeds"
- URL-Liste bearbeiten

### LLM-Prompt anpassen
- Workflow 01 → Node "LLM Curation"
- System-Prompt bearbeiten

### LinkedIn-Post-Format
- Workflow 02 → Node "Format LinkedIn Post"
- Template bearbeiten

### Newsletter-HTML
- Workflow 03 → Node "Build Newsletter HTML"
- Template bearbeiten (oder externes HTML-File referenzieren)

---

## Maintenance

- n8n-Updates: `docker-compose pull && docker-compose up -d` (im /var/lib/n8n/)
- Workflow-Export: nach jeder Änderung JSON exportieren → commit ins Git-Repo
- Logs: `docker logs n8n --tail 100 -f`

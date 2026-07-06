# n8n Workflow Import — Levcon AI News

**Ziel:** Die 3 n8n-Workflows auf engine.levcon.at importieren und aktivieren.

---

## Voraussetzungen

- ✅ n8n läuft auf https://engine.levcon.at (Docker, Port 5678 intern)
- ✅ Login zu n8n funktioniert bereits
- ✅ Next.js läuft auf https://levcon.ai
- ✅ `.env` auf VPS hat `LEVCON_INTERNAL_API_KEY` gesetzt

---

## Schritt 1: Credentials in n8n anlegen

**WICHTIG:** Vor dem Workflow-Import diese 4 Credentials anlegen.

1. n8n-UI öffnen: https://engine.levcon.at
2. Einloggen
3. Settings → Credentials → "Add Credential"

### Credential 1: Levcon Internal API (Header Auth)
- **Typ:** Header Auth
- **Name:** `Levcon Internal API`
- **Header Name:** `X-Levcon-Api-Key`
- **Value:** `<LEVCON_INTERNAL_API_KEY aus .env>`

### Credential 2: z-ai LLM (HTTP Header Auth)
- **Typ:** HTTP Header Auth
- **Name:** `z-ai LLM`
- **Header Name:** `Authorization`
- **Value:** `Bearer <ZAI_API_KEY>`

### Credential 3: SMTP Levcon (SMTP)
- **Typ:** SMTP
- **Name:** `SMTP Levcon`
- **Host:** `smtp.ionos.de`
- **Port:** 587
- **User:** `admin@levcon.at`
- **Password:** `<IONOS-Passwort>`
- **TLS:** eingeschaltet (STARTTLS)

### Credential 4: LinkedIn Levcon (OAuth2 API) — OPTIONAL, FÜR SPÄTER
- **Typ:** LinkedIn OAuth2 API
- **Name:** `LinkedIn Levcon`
- **Client ID:** (später eintragen)
- **Client Secret:** (später eintragen)
- **Scopes:** `w_member_social`
- **Redirect URI:** `https://engine.levcon.at/rest/oauth2-credential/callback`

---

## Schritt 2: Workflows importieren

Die Workflow-JSON-Dateien liegen im GitHub-Repo unter:
```
ai-news/n8n-workflows/
├── workflow-01-collect-and-curate.json
├── workflow-02-linkedin-post.json
└── workflow-03-newsletter-send.json
```

### Variante A: UI-Import (empfohlen)

1. Auf dem VPS die Workflow-Dateien herunterladen:
   ```bash
   cd /tmp
   git clone https://github.com/LEVCON-AT/official.git levcon-repo
   cd levcon-repo/ai-news/n8n-workflows/
   ```

2. In n8n-UI: Workflows → "Import from File"
3. Lade nacheinander hoch:
   - `workflow-01-collect-and-curate.json`
   - `workflow-02-linkedin-post.json`
   - `workflow-03-newsletter-send.json`

4. Jeden Workflow öffnen und Credentials zuweisen:
   - HTTP-Request-Nodes mit "Levcon Internal API" verknüpfen
   - z-ai-LLM-Node mit "z-ai LLM" verknüpfen
   - SMTP-Node mit "SMTP Levcon" verknüpfen
   - LinkedIn-Node überspringen (für später)

5. Workflow speichern

6. Workflow aktivieren (Toggle oben rechts)

### Variante B: API-Import (optional, für Automation)

Falls du später einen API-Key hast, kannst du Workflows via API importieren:

```bash
# n8n API-Key erstellen in der UI:
# Settings → API → "Create an API key"

N8N_API_KEY="dein-api-key"
N8N_HOST="https://engine.levcon.at"

for workflow in workflow-01-collect-and-curate workflow-02-linkedin-post workflow-03-newsletter-send; do
  curl -X POST "$N8N_HOST/api/v1/workflows" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d @/tmp/levcon-repo/ai-news/n8n-workflows/${workflow}.json
done
```

---

## Schritt 3: n8n Environment Variablen (für Docker)

In der n8n docker-compose.yml (oder `.env` des n8n-Containers) folgende Variablen setzen:

```env
# n8n Encryption Key (für Credential-Verschlüsselung)
N8N_ENCRYPTION_KEY=<bereits-vorhanden>

# Levcon Internal API
LEVCON_API_BASE=https://levcon.ai
LEVCON_INTERNAL_API_KEY=<GLEICH-WIE-IN-NEXTJS-.env>

# z-ai LLM
ZAI_API_KEY=<dein-z-ai-key>
ZAI_API_ENDPOINT=https://api.z.ai/api/paas/v4

# SMTP (für n8n Error-Emails)
ALERT_EMAIL=admin@levcon.at

# Site URL (für Links in Posts/Mails)
NEXT_PUBLIC_SITE_URL=https://levcon.ai
```

**Wichtig:** Nach Ändern der env-Vars n8n-Container neu starten:
```bash
docker restart n8n
```

---

## Schritt 4: Workflow-Tests

### Test 1: Collect & Curate Workflow

1. In n8n-UI: Workflow 01 öffnen
2. Auf "Execute Workflow" klicken (manueller Trigger)
3. Prüfen:
   - RSS-Feeds wurden abgerufen
   - LLM hat Items kuratiert
   - POST an `/api/ai-news/internal/ingest` war erfolgreich (200 OK)
4. Auf https://levcon.ai prüfen: AI News Panel zeigt die kuratierten News

### Test 2: Newsletter Workflow

1. Auf der Website: AI News Newsletter anmelden (Test-E-Mail)
2. Bestätigungs-Mail prüfen (Postfach)
3. Auf Bestätigungslink klicken
4. In n8n: Workflow 03 manuell triggern
5. Newsletter sollte im Postfach ankommen

### Test 3: Cron-Trigger

1. Workflow 01 aktivieren (Toggle)
2. Warten bis 06:00 CET — oder Cron temporär auf "in 5 Minuten" setzen
3. Prüfen, ob Workflow automatisch läuft

---

## Schritt 5: Monitoring

### n8n-UI
- Executions-Tab: Alle Workflow-Läufe mit Status
- Bei Fehlern: Error-Node sendet Mail an `admin@levcon.at`

### Logs
```bash
# n8n Logs
docker logs n8n -f

# Next.js Logs
journalctl -u levcon -f

# Nginx Logs
tail -f /var/log/nginx/levcon.ai.access.log
tail -f /var/log/nginx/levcon.ai.error.log
```

---

## Troubleshooting

### Workflow schlägt fehl: "Connection refused"
- Prüfen: Läuft Next.js? `systemctl status levcon`
- Prüfen: Läuft n8n? `docker ps | grep n8n`

### LLM-Node: "401 Unauthorized"
- ZAI_API_KEY in n8n-Credential "z-ai LLM" prüfen

### SMTP-Node: "535 Authentication failed"
- IONOS-Passwort in n8n-Credential "SMTP Levcon" prüfen

### Newsletter kommt nicht an
- Spam-Ordner prüfen
- SPF/DKIM/DMARC für levcon.at (IONOS) prüfen
- Mail-Tester.com: Test-Mail senden, Score prüfen

### Internal API: "401 Unauthorized"
- `LEVCON_INTERNAL_API_KEY` in n8n env muss mit `.env` auf VPS übereinstimmen

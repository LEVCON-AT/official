# Levcon.ai — API-Key & n8n Erneuerung Anleitung

**Stand:** September 2026
**Zweck:** Vollständige Referenz für API-Key-Management und n8n-Workflow-Aktualisierung

Diese Anleitung deckt ab:
1. **API-Key-Management** (Staging + Production)
2. **n8n Workflow-Erneuerung** (Code-Nodes + Workflow-JSON + Credentials)

---

## Inhaltsverzeichnis

- [Teil 1: API-Key-Management](#teil-1-api-key-management)
  - [1.1 Wo stehen die API-Keys?](#11-wo-stehen-die-api-keys)
  - [1.2 API-Keys anzeigen](#12-api-keys-anzeigen)
  - [1.3 API-Keys ändern (regenerieren)](#13-api-keys-ändern-regenerieren)
  - [1.4 Wo der Key überall eingetragen werden muss](#14-wo-der-key-überall-eingetragen-werden-muss)
  - [1.5 Was NIEMALS committed wird](#15-was-niemals-committed-wird)
- [Teil 2: n8n Workflow-Erneuerung](#teil-2-n8n-workflow-erneuerung)
  - [2.1 Was wird aktualisiert?](#21-was-wird-aktualisiert)
  - [2.2 Vorbereitung](#22-vorbereitung)
  - [2.3 Workflow-01 aktualisieren (Collect & Curate)](#23-workflow-01-aktualisieren-collect--curate)
  - [2.4 Workflow-03 aktualisieren (Newsletter Send)](#24-workflow-03-aktualisieren-newsletter-send)
  - [2.5 Credentials zuweisen](#25-credentials-zuweisen)
  - [2.6 Manueller Test-Run](#26-manueller-test-run)
  - [2.7 Verifikation im Admin-Panel](#27-verifikation-im-admin-panel)
  - [2.8 Rollback im Notfall](#28-rollback-im-notfall)

---

# Teil 1: API-Key-Management

## 1.1 Wo stehen die API-Keys?

Es gibt **zwei verschiedene API-Keys** (bewusst unterschiedlich aus Sicherheitsgründen):

| Environment | Datei auf VPS | Variable | Zweck |
|-------------|--------------|----------|-------|
| **Production** | `/var/www/levcon/.env` | `LEVCON_INTERNAL_API_KEY` | Schützt `levcon.ai/api/ai-news/internal/*` |
| **Staging** | `/var/www/levcon-staging/.env` | `LEVCON_INTERNAL_API_KEY` | Schützt `staging.levcon.ai/api/ai-news/internal/*` |

**Wichtig:** Beide Keys sind **verschieden**. Wenn du den Production-Key in Staging einsetzt (oder umgekehrt), funktioniert die Authentifizierung nicht.

## 1.2 API-Keys anzeigen

### Staging-API-Key anzeigen

```bash
ssh root@87.106.25.91
grep LEVCON_INTERNAL_API_KEY /var/www/levcon-staging/.env
```

**Output-Format:**
```
LEVCON_INTERNAL_API_KEY="abc123def456...xyz789"
```

Der Key ist der Wert **zwischen den Anführungszeichen** (64 Zeichen hex).

### Production-API-Key anzeigen

```bash
ssh root@87.106.25.91
grep LEVCON_INTERNAL_API_KEY /var/www/levcon/.env
```

### Beide Keys auf einmal anzeigen (für Copy-Paste)

```bash
ssh root@87.106.25.91 'echo "STAGING:"; grep LEVCON_INTERNAL_API_KEY /var/www/levcon-staging/.env; echo ""; echo "PRODUCTION:"; grep LEVCON_INTERNAL_API_KEY /var/www/levcon/.env'
```

## 1.3 API-Keys ändern (regenerieren)

### Staging-API-Key neu generieren

```bash
ssh root@87.106.25.91

# Neuen Key generieren
NEW_KEY=$(openssl rand -hex 32)
echo "Neuer Staging-API-Key: $NEW_KEY"

# In .env eintragen
sed -i "s|^LEVCON_INTERNAL_API_KEY=.*|LEVCON_INTERNAL_API_KEY=\"$NEW_KEY\"|" /var/www/levcon-staging/.env

# Verifizieren
grep LEVCON_INTERNAL_API_KEY /var/www/levcon-staging/.env

# Service neustarten (lädt neue .env)
systemctl restart levcon-staging

# Status prüfen
systemctl is-active levcon-staging
```

**Nach dem Ändern des Staging-API-Keys:**
- ✅ Staging-Admin-Panel mit neuem Key aufrufen: `https://staging.levcon.ai/ai-news?admin=<NEUER_KEY>`
- ✅ Falls n8n auf Staging-API zugreift: n8n Credential aktualisieren (siehe [2.5](#25-credentials-zuweisen))

### Production-API-Key neu generieren

```bash
ssh root@87.106.25.91

# Backup der Production-DB (Sicherheit!)
cp /var/www/levcon/db/levcon.db /var/www/levcon/db/levcon.db.backup-$(date +%Y%m%d)

# Neuen Key generieren
NEW_KEY=$(openssl rand -hex 32)
echo "Neuer Production-API-Key: $NEW_KEY"

# In .env eintragen
sed -i "s|^LEVCON_INTERNAL_API_KEY=.*|LEVCON_INTERNAL_API_KEY=\"$NEW_KEY\"|" /var/www/levcon/.env

# Verifizieren
grep LEVCON_INTERNAL_API_KEY /var/www/levcon/.env

# Service neustarten
systemctl restart levcon

# Status prüfen
systemctl is-active levcon
```

**Nach dem Ändern des Production-API-Keys:**
- ✅ n8n Credential "Levcon Internal API" aktualisieren (sonst schlägt Workflow-01 fehl!)
- ✅ Falls du den alten Key irgendwo gespeichert hast (z.B. Password Manager) → aktualisieren
- ✅ Production-Admin-Panel mit neuem Key: `https://levcon.ai/ai-news?admin=<NEUER_KEY>`

## 1.4 Wo der Key überall eingetragen werden muss

Wenn du den API-Key änderst, musst du ihn an folgenden Stellen aktualisieren:

### Für Production:
| # | Ort | Was tun |
|---|-----|---------|
| 1 | `/var/www/levcon/.env` | `sed -i` Befehl aus 1.3 |
| 2 | n8n Credential "Levcon Internal API" | Siehe [2.5](#25-credentials-zuweisen) |
| 3 | Dein Password Manager (falls gespeichert) | Manuell aktualisieren |
| 4 | Admin-Panel-Bookmark (falls gespeichert) | Neue URL mit neuem Key |

### Für Staging:
| # | Ort | Was tun |
|---|-----|---------|
| 1 | `/var/www/levcon-staging/.env` | `sed -i` Befehl aus 1.3 |
| 2 | n8n Credential "Levcon Internal API (Staging)" falls angelegt | Siehe [2.5](#25-credentials-zuweisen) |
| 3 | Admin-Panel-URL | Neu aufrufen mit neuem Key |

## 1.5 Was NIEMALS committed wird

| Wo | Warum nicht |
|----|-------------|
| GitHub Repo (committed Code) | ❌ `.env` ist in `.gitignore` |
| `deploy/.env.staging` Template | ❌ Hat nur Platzhalter `CHANGE_ME_TO_32_CHARS_RANDOM_STAGING` |
| Frontend-Code (Client-Bundle) | ❌ Wäre öffentlich sichtbar |
| Logs / Console-Output | ❌ Niemals ausgeben! |
| Chat / E-Mails | ❌ Niemals im Klartext teilen |

**Schon passiert?** Falls ein API-Key versehentlich committet wurde:
```bash
# Key sofort regenerieren (siehe 1.3)
# Dann: aus Git-History entfernen (komplex — besser: neuen Key generieren)
```

---

# Teil 2: n8n Workflow-Erneuerung

## 2.1 Was wird aktualisiert?

Die Quality-Gate-Architektur hat 3 Code-Nodes verändert und 1 neuen hinzugefügt:

| Datei | Status | Was geändert wurde |
|-------|--------|---------------------|
| `03-build-ollama-request.code.js` | **UPDATE v5 → v6** | Retry-Loop (3 Level) + Vortages-Fallback + `num_predict=8192` |
| `04-render-newsletter.code.js` | **UPDATE v4 → v5** | Partial-Warning Block + Fallback-Hint |
| `06-validate-llm-output.code.js` | **NEU** | Post-LLM Validation Gate |
| `workflow-01-collect-and-curate.json` | **UPDATE** | 12 → 13 Nodes (Validate LLM Output hinzugefügt) |

Workflow-02 (LinkedIn) und Workflow-04 (Cleanup) bleiben unverändert.

## 2.2 Vorbereitung

### 2.2.1 API-Keys notieren

Bevor du startest, brauchst du beide API-Keys (siehe [1.2](#12-api-keys-anzeigen)):

```bash
ssh root@87.106.25.91 'echo "STAGING:"; grep LEVCON_INTERNAL_API_KEY /var/www/levcon-staging/.env; echo ""; echo "PRODUCTION:"; grep LEVCON_INTERNAL_API_KEY /var/www/levcon/.env'
```

Notiere dir beide Keys (sicher speichern, z.B. in Password Manager).

### 2.2.2 n8n öffnen

```
URL: https://engine.levcon.at
Login: dein n8n-Login
```

### 2.2.3 Code-Node-Dateien auf VPS verfügbar machen

Die aktualisierten Code-Node-Dateien liegen auf dem VPS unter:
```
/var/www/levcon/ai-news/n8n-workflows/code-nodes-refined/
├── 01-fetch-all-rss.code.js           (unverändert)
├── 02-score-and-rank.code.js          (unverändert)
├── 03-build-ollama-request.code.js    ← v6 (UPDATE)
├── 04-render-newsletter.code.js        ← v5 (UPDATE)
├── 05-update-subscriber-last-sent.code.js (unverändert)
└── 06-validate-llm-output.code.js      ← NEU
```

Du kannst sie dir auf dem VPS anzeigen lassen mit:
```bash
ssh root@87.106.25.91
cat /var/www/levcon/ai-news/n8n-workflows/code-nodes-refined/03-build-ollama-request.code.js
```

Oder auf deinen lokalen Rechner kopieren:
```bash
scp -r root@87.106.25.91:/var/www/levcon/ai-news/n8n-workflows/ ~/Desktop/levcon-n8n/
```

## 2.3 Workflow-01 aktualisieren (Collect & Curate)

### Option A: Kompletten Workflow re-importieren (empfohlen)

Diese Methode ist am sichersten, weil alle Code-Nodes automatisch auf dem neuesten Stand sind.

#### Schritt 1: Workflow-JSON herunterladen

```bash
# Auf VPS:
ssh root@87.106.25.91
cat /var/www/levcon/ai-news/n8n-workflows/workflow-01-collect-and-curate.json | head -20
# (nur zum Prüfen ob es die neue Version mit 13 Nodes ist)

# Alternativ: auf lokalen Rechner kopieren
scp root@87.106.25.91:/var/www/levcon/ai-news/n8n-workflows/workflow-01-collect-and-curate.json ~/Desktop/
```

#### Schritt 2: In n8n importieren

1. **n8n → Workflows → "Add Workflow" (oder "New")**
2. **Drei-Punkte-Menü (⋮) → "Import from File"**
3. Datei auswählen: `workflow-01-collect-and-curate.json`
4. **Import bestätigen**

#### Schritt 3: Workflow überprüfen

Nach dem Import solltest du **13 Nodes** sehen (vorher 12):

```
Cron Daily 06:00 Vienna (Trigger)
        ↓
Fetch All RSS Feeds ──┐
                      ↓
SearXNG Multi-Search ─┤
                      ↓
              Merge RSS + Search
                      ↓
              Dedupe by URL
                      ↓
              Score and Rank
                      ↓
              Build Ollama Request          ← v6 (Retry + Fallback)
                      ↓
              Validate LLM Output            ← NEU!
                      ↓
              POST to Levcon Ingest
                      ↓
              ┌───────────────────┐
              ↓                   ↓
    Trigger LinkedIn     Trigger Newsletter
      Workflow              Workflow

On Workflow Error → Send Alert Email
```

#### Schritt 4: Workflow benennen

- Name: `Levcon AI News — Collect & Curate (v6 Quality-Gate)` (oder ähnlich)
- Speichern

### Option B: Code-Nodes manuell aktualisieren

Falls du den Workflow nicht komplett neu importieren willst, kannst du auch nur die Code-Nodes überschreiben:

#### 2.3.1 "Build Ollama Request" Node aktualisieren

1. **Workflow-01 öffnen** in n8n
2. **"Build Ollama Request" Node doppelklicken**
3. **JavaScript-Code-Feld: alles markieren + löschen**
4. **Neuen Code einfügen** aus:
   ```
   /var/www/levcon/ai-news/n8n-workflows/code-nodes-refined/03-build-ollama-request.code.js
   ```
5. **"Save" klicken**

#### 2.3.2 Neuen "Validate LLM Output" Node hinzufügen

1. **Im Workflow: "+" (Add Node) klicken**
2. **Node-Typ: "Code"** auswählen
3. **Name:** `Validate LLM Output`
4. **JavaScript-Code einfügen** aus:
   ```
   /var/www/levcon/ai-news/n8n-workflows/code-nodes-refined/06-validate-llm-output.code.js
   ```
5. **Positionieren zwischen:**
   - **Input:** "Build Ollama Request" → "Validate LLM Output"
   - **Output:** "Validate LLM Output" → "POST to Levcon Ingest"
6. **Verbindungen ziehen** (Drag-and-Drop der Output-Punkte zu Input-Punkten)
7. **"Save" klicken**

#### 2.3.3 Verifikation der Node-Reihenfolge

Stelle sicher, dass die Execution-Order korrekt ist:

```
Score and Rank → Build Ollama Request → Validate LLM Output → POST to Levcon Ingest
```

Klicke auf "Execute Workflow" → dann siehst du den Flow.

## 2.4 Workflow-03 aktualisieren (Newsletter Send)

Workflow-03 braucht nur ein Update des "Render Newsletter HTML" Nodes (für Partial-Warning Block + Fallback-Hint).

### Schritt 1: Workflow-03 öffnen

n8n → Workflows → "Levcon AI News — Newsletter Send" öffnen (oder ähnlicher Name)

### Schritt 2: "Render Newsletter HTML" Node aktualisieren

1. **"Render Newsletter HTML" Node doppelklicken**
2. **JavaScript-Code-Feld: alles markieren + löschen**
3. **Neuen Code einfügen** aus:
   ```
   /var/www/levcon/ai-news/n8n-workflows/code-nodes-refined/04-render-newsletter.code.js
   ```
4. **"Save" klicken**

### Schritt 3: Workflow speichern

- Name beibehalten oder `v5 (Partial-Warning)` anhängen
- Save

## 2.5 Credentials zuweisen

Beim Re-Import eines Workflows gehen Credentials verloren. Du musst sie neu zuweisen.

### 2.5.1 API-Credential aktualisieren (für Production-Workflow)

1. **n8n → Settings → Credentials**
2. **Vorhandene Credential "Levcon Internal API" öffnen** (oder neu erstellen)
3. **Werte eintragen:**
   - **Credential Type:** HTTP Header Auth
   - **Name:** `Levcon Internal API`
   - **Header Name:** `X-Levcon-Api-Key`
   - **Header Value:** `<PRODUCTION_API_KEY>` (aus `/var/www/levcon/.env`)
4. **Save**

### 2.5.2 SMTP-Credential prüfen

1. **Credential "SMTP Levcon" öffnen** (oder ähnlich)
2. **Werte verifizieren:**
   - **SMTP Host:** `smtp.ionos.de` (nicht `smtp.ionos.at`!)
   - **Port:** `587`
   - **User:** `admin@levcon.at`
   - **Password:** dein IONOS-Passwort
3. **Save**

### 2.5.3 Credentials in Nodes zuweisen

Öffne jeden dieser Nodes im Workflow und weise die Credentials zu:

| Node | Workflow | Credential | Wert |
|------|----------|-----------|------|
| "POST to Levcon Ingest" | 01 | `Levcon Internal API` | Production-API-Key |
| "Send Alert Email" | 01 | `SMTP Levcon` | (IONOS SMTP) |
| "Fetch Today News" | 03 | `Levcon Internal API` | Production-API-Key |
| "Fetch Subscribers" | 03 | `Levcon Internal API` | Production-API-Key |
| "Send Newsletter Email" | 03 | `SMTP Levcon` | (IONOS SMTP) |
| "Update Subscriber Last Sent" | 03 | `Levcon Internal API` | Production-API-Key |

### 2.5.4 Optional: Staging-Credentials anlegen

Falls du Workflow-01 auf Staging testen willst (empfohlen!):

1. **n8n → Settings → Credentials → "Add Credential"**
2. **Neue HTTP Header Auth:**
   - **Name:** `Levcon Internal API (Staging)`
   - **Header Name:** `X-Levcon-Api-Key`
   - **Header Value:** `<STAGING_API_KEY>` (aus `/var/www/levcon-staging/.env`)
3. **Save**

Du kannst dann in einer Staging-Kopie des Workflows diese Credential verwenden.

## 2.6 Manueller Test-Run

### 2.6.1 Workflow-01 testen

1. **Workflow-01 öffnen** (v6 mit 13 Nodes)
2. **Oben rechts: Toggle "Inactive" → "Active"** (falls noch inaktiv)
3. **"Execute Workflow" klicken** (oder Play-Button beim Trigger-Node)
4. **Warten** — kann 5-15 Minuten dauern (CPU-Inference mit Ollama)

### 2.6.2 Was du im Execution-Log sehen solltest

Im Output des "Build Ollama Request" Nodes:
```
[Build Ollama v6] 20 Items für 2 Läufe (DE=10, EN=10)
[Build Ollama v6] DE-Run Level 0 startet (10 Items, num_predict=8192, temp=0.2)
[Build Ollama v6] DE-Run Level 0 fertig in 145.3s
[Build Ollama v6] EN-Run Level 0 startet (10 Items, ...)
[Build Ollama v6] EN-Run Level 0 fertig in 152.1s
[Build Ollama v6] Merge: 20 Items (DE=10, EN=10)
[Build Ollama v6] Partial: no, Retries: 0
```

Im Output des "Validate LLM Output" Nodes:
```
[Validate v1] Input: 20 items
[Validate v1] Report:
  Status: success
  Valid: 20/20 (DE=10, EN=10)
  Warnings: 0, Errors: 0
  Fallback recommendation: none
```

### 2.6.3 Falls Warnings/Errors auftreten

Das ist **nicht schlimm** — das ist genau der Sinn des Validation Gates!

Beispiel-Warnings:
- `"Item 4: descriptionDe doesn't end with sentence punctuation (possible truncation)"` → Qwen hat abgeschnitten
- `"Item 7: descriptionDe too short (45 chars, min 50)"` → Qwen war zu faul
- `"EN bucket below threshold (6/7)"` → EN-Bucket zu klein

In jedem Fall: ungültige Items werden gedroppt, gültige werden in die DB geschrieben.

## 2.7 Verifikation im Admin-Panel

### 2.7.1 Production-Admin-Panel

1. **Production-API-Key holen:**
   ```bash
   ssh root@87.106.25.91 "grep LEVCON_INTERNAL_API_KEY /var/www/levcon/.env"
   ```

2. **Browser öffnen:**
   ```
   https://levcon.ai/ai-news?admin=<PRODUCTION_API_KEY>
   ```

3. **"QUALITY MONITORING" Panel sollte erscheinen mit:**
   - ✅ 1 Run in der Per-Day-Liste (mit grünem ✓ Icon)
   - ✅ "ERFOLGSRATE 100%" (1/1 Runs)
   - ✅ "Ø ITEMS/TAG 20" (DE: 10 · EN: 10)
   - ✅ "RETRIES 0", "WARNINGS 0", "FALLBACKS 0"

### 2.7.2 Staging-Admin-Panel

1. **Staging-API-Key holen:**
   ```bash
   ssh root@87.106.25.91 "grep LEVCON_INTERNAL_API_KEY /var/www/levcon-staging/.env"
   ```

2. **Browser öffnen:**
   ```
   https://staging.levcon.ai/ai-news?admin=<STAGING_API_KEY>
   ```

3. **Basic Auth Dialog** → Username + Passwort eingeben (das du mit `setup-staging-auth.sh` gesetzt hast)

4. **"QUALITY MONITORING" Panel erscheint** (initial leer — kein Run auf Staging bis du Workflow-01 gegen Staging testest)

### 2.7.3 DB-Verifikation (direkt auf VPS)

```bash
ssh root@87.106.25.91

# Production-DB
sqlite3 /var/www/levcon/db/levcon.db \
  "SELECT id, runAt, status, itemCount, itemCountDe, itemCountEn, retryCount, warningCount, fallbackUsed FROM workflow_runs ORDER BY runAt DESC LIMIT 5;"

# Staging-DB
sqlite3 /var/www/levcon-staging/db/levcon-staging.db \
  "SELECT id, runAt, status, itemCount, itemCountDe, itemCountEn, retryCount, warningCount, fallbackUsed FROM workflow_runs ORDER BY runAt DESC LIMIT 5;"
```

**Erwartete Output (nach erfolgreichem Test-Run):**
```
1|2026-09-05 06:00:12|success|20|10|10|0|0|none
```

## 2.8 Rollback im Notfall

Falls der neue Workflow nicht funktioniert:

### 2.8.1 n8n-Workflow deaktivieren

1. **n8n → Workflow-01 öffnen**
2. **Toggle "Active" → "Inactive"** (oben rechts)
3. **alten Workflow wieder aktivieren** (falls du ihn behalten hast)

### 2.8.2 Code-Nodes zurücksetzen

Falls du Option B (manuelle Aktualisierung) gewählt hast:

1. **"Build Ollama Request" Node öffnen**
2. **Code ersetzen mit der v5-Version** (vorheriges Commit auf GitHub, vor `3a07228`)
3. **"Validate LLM Output" Node löschen**
4. **Verbindung direkt:** Build Ollama → POST to Levcon Ingest (ohne Validate dazwischen)
5. **Save**

### 2.8.3 Production-DB zurücksetzen

**Nur im absoluten Notfall** — nur falls die neuen Telemetry-Daten die App stören:

```bash
ssh root@87.106.25.91
systemctl stop levcon
cp /var/www/levcon/db/levcon.db.backup-YYYYMMDD /var/www/levcon/db/levcon.db
chown www-data:www-data /var/www/levcon/db/levcon.db
systemctl start levcon
```

### 2.8.4 Hilfe holen

Falls etwas nicht klappt, teile mir folgendes mit:
- Screenshot des n8n Execution-Logs (vom fehlgeschlagenen Node)
- Output von `journalctl -u levcon --no-pager -n 30` (falls Production betroffen)
- Output von `sqlite3 /var/www/levcon/db/levcon.db ".schema workflow_runs"` (Schema prüfen)

---

# Anhang: Quick-Reference

## API-Key schnell anzeigen

```bash
ssh root@87.106.25.91 'echo "=== STAGING ==="; grep LEVCON_INTERNAL_API_KEY /var/www/levcon-staging/.env; echo ""; echo "=== PRODUCTION ==="; grep LEVCON_INTERNAL_API_KEY /var/www/levcon/.env'
```

## API-Key schnell ändern

```bash
# Staging
ssh root@87.106.25.91
NEW=$(openssl rand -hex 32)
sed -i "s|^LEVCON_INTERNAL_API_KEY=.*|LEVCON_INTERNAL_API_KEY=\"$NEW\"|" /var/www/levcon-staging/.env
systemctl restart levcon-staging
echo "Neuer Staging-Key: $NEW"

# Production
NEW=$(openssl rand -hex 32)
sed -i "s|^LEVCON_INTERNAL_API_KEY=.*|LEVCON_INTERNAL_API_KEY=\"$NEW\"|" /var/www/levcon/.env
systemctl restart levcon
echo "Neuer Production-Key: $NEW"
# WICHTIG: Danach n8n Credential aktualisieren!
```

## Admin-Panel URLs

```
# Production (keine Basic Auth):
https://levcon.ai/ai-news?admin=<PRODUCTION_API_KEY>

# Staging (mit Basic Auth):
https://staging.levcon.ai/ai-news?admin=<STAGING_API_KEY>
# Browser fragt nach Basic-Auth-User + Passwort
```

## n8n URLs

```
n8n UI: https://engine.levcon.at
Workflow 01 (Collect & Curate): in n8n Workflows-Liste
Workflow 03 (Newsletter Send):  in n8n Workflows-Liste
```

## Code-Node-Dateien (Quelle der Wahrheit)

```
Production (/var/www/levcon/):
├── ai-news/n8n-workflows/code-nodes-refined/03-build-ollama-request.code.js    (v6)
├── ai-news/n8n-workflows/code-nodes-refined/04-render-newsletter.code.js        (v5)
├── ai-news/n8n-workflows/code-nodes-refined/06-validate-llm-output.code.js      (NEU v1)
└── ai-news/n8n-workflows/workflow-01-collect-and-curate.json                   (13 Nodes)

Staging (/var/www/levcon-staging/):
└── (gleiche Struktur, branch: staging)
```

## Workflow-Test-Befehle

```bash
# Production testen (manueller Workflow-Run in n8n, dann auf VPS prüfen):
ssh root@87.106.25.91 "sqlite3 /var/www/levcon/db/levcon.db 'SELECT * FROM workflow_runs ORDER BY id DESC LIMIT 1;'"

# Staging testen (gleicher Befehl, anderer Pfad):
ssh root@87.106.25.91 "sqlite3 /var/www/levcon-staging/db/levcon-staging.db 'SELECT * FROM workflow_runs ORDER BY id DESC LIMIT 1;'"

# Health Check Production:
curl -I https://levcon.ai/

# Health Check Staging (mit Basic Auth):
curl -I -u <user>:<password> https://staging.levcon.ai/
```

---

# Checkliste: Komplette n8n-Erneuerung

## Vorbereitung
- [ ] API-Keys notiert (Staging + Production, siehe [1.2](#12-api-keys-anzeigen))
- [ ] n8n erreichbar unter https://engine.levcon.at
- [ ] Code-Node-Dateien auf VPS verfügbar (unter `/var/www/levcon/ai-news/n8n-workflows/code-nodes-refined/`)

## Workflow-01 aktualisieren
- [ ] Workflow-01 re-importiert (13 Nodes sichtbar, siehe [2.3](#23-workflow-01-aktualisieren-collect--curate))
- [ ] "Validate LLM Output" Node sichtbar zwischen "Build Ollama Request" und "POST to Levcon Ingest"
- [ ] Credentials neu zugewiesen (Levcon Internal API + SMTP Levcon)
- [ ] Workflow aktiviert (Toggle auf "Active")

## Workflow-03 aktualisieren
- [ ] "Render Newsletter HTML" Code aktualisiert (v5)
- [ ] Credentials zugewiesen (wo nötig)

## Test-Run
- [ ] Workflow-01 manuell ausgeführt (5-15 Min gewartet)
- [ ] Execution-Log zeigt v6 + v1 Logs (Build Ollama v6, Validate v1)
- [ ] DB-Eintrag in `workflow_runs` erstellt (mit itemCountDe, retryCount etc.)

## Verifikation
- [ ] Production-Admin-Panel zeigt den Run (`https://levcon.ai/ai-news?admin=<KEY>`)
- [ ] Per-Day-Liste zeigt 1 Run mit Status "success"
- [ ] Stat-Cards zeigen korrekte Werte (Ø Items, Retries, Warnings, Fallbacks)

## Optional: Staging-Test
- [ ] Staging-Credential "Levcon Internal API (Staging)" in n8n angelegt
- [ ] Staging-Version des Workflows gegen `staging.levcon.ai` getestet
- [ ] Staging-Admin-Panel zeigt den Run (mit Basic Auth + Admin-Token)

---

*Dokument erstellt: September 2026 — Teil der Levcon.ai Projekt-Dokumentation.*
*Siehe auch: `deploy/STAGING.md`, `PROJECT-CONTEXT.md`, `ai-news/QUALITY-GUIDELINES.md`*

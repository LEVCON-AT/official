# Levcon.ai — Staging CI/CD Pipeline

**Stand:** Juli 2026
**Status:** Production Live (levcon.ai) + Staging Ready (staging.levcon.ai)

Diese Dokumentation beschreibt die komplette Staging-Umgebung: Branch-Strategie, VPS-Setup, GitHub Actions, DNS, und Test-Workflow.

---

## 1. Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Repository: LEVCON-AT/official                      │
│                                                              │
│  Branches:                                                   │
│  ├── main          → Production (levcon.ai)                  │
│  ├── staging       → Staging (staging.levcon.ai)             │
│  └── feature/*     → Entwicklung (lokales Dev / Preview)     │
│                                                              │
│  Workflows:                                                  │
│  ├── .github/workflows/deploy.yml         (main → VPS Prod)  │
│  └── .github/workflows/deploy-staging.yml (staging → VPS St) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  VPS: 87.106.25.91 (gleicher Server für Prod + Staging)     │
│                                                              │
│  Production:                                                 │
│  ├── /var/www/levcon          (Project Dir)                  │
│  ├── db/levcon.db             (SQLite, eigene DB)            │
│  ├── Port 3002                (Next.js Standalone)           │
│  ├── systemd: levcon          (Service)                      │
│  └── nginx: levcon.ai         (Domain + SSL)                 │
│                                                              │
│  Staging:                                                    │
│  ├── /var/www/levcon-staging  (Project Dir, getrennt)        │
│  ├── db/levcon-staging.db     (eigene DB, getrennt)          │
│  ├── Port 3003                (Next.js Standalone)           │
│  ├── systemd: levcon-staging  (Service)                      │
│  └── nginx: staging.levcon.ai (Domain + SSL, getrennt)       │
└─────────────────────────────────────────────────────────────┘
```

**Wichtige Trennung:**
- Eigene Projekt-Verzeichnisse (kein Code-Sharing)
- Eigene SQLite-DBs (Staging darf nie Production-Daten sehen)
- Eigene Ports (3002 Prod, 3003 Staging)
- Eigene systemd-Services
- Eigene Subdomains
- Eigene API-Keys (`LEVCON_INTERNAL_API_KEY`)

---

## 2. Branch-Strategie

### Workflow

```
feature/xyz  ──PR──→  staging  ──PR──→  main
   (Dev)              (Staging)         (Production)
```

1. **Feature-Branch erstellen** (z.B. `feature/quality-gate`)
   ```bash
   git checkout staging
   git pull origin staging
   git checkout -b feature/quality-gate
   # ... entwickeln ...
   git push origin feature/quality-gate
   ```

2. **PR nach `staging`** → Review → Merge → Auto-Deploy auf staging.levcon.ai

3. **QA auf staging.levcon.ai** → Wenn OK: PR von `staging` nach `main`

4. **PR nach `main`** → Review → Merge → Auto-Deploy auf levcon.ai (Production)

### Branch-Protection (empfohlen)

In GitHub: Settings → Branches → Add rule

**Für `main`:**
- ☑ Require pull request before merging
- ☑ Require approvals: 1
- ☑ Require status checks to pass: `Deploy to VPS` (staging muss erfolgreich sein)
- ☑ Require branches to be up to date before merging
- ☑ Do not allow bypassing the above settings

**Für `staging`:**
- ☑ Require pull request before merging
- ☑ Require approvals: 1 (kann auch Owner selbst sein)
- ☐ Status checks optional (Staging darf auch ohne Deploy-Check mergen)

---

## 3. DNS-Einrichtung (Owner-Aufgabe)

**Voraussetzung:** Du kontrollierst die DNS-Zonen für `levcon.ai` (oder `levcon.at`).

### Eintrag anlegen

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | staging | 87.106.25.91 | 3600 |

**Bei IONOS (vermutlich dein DNS-Provider):**
1. Login bei IONOS
2. DNS → levcon.ai (oder levcon.at — je nachdem wo die Domain liegt)
3. Neuen DNS-Eintrag anlegen:
   - Typ: A
   - Host: `staging`
   - Wert: `87.106.25.91`
   - TTL: 1 Stunde
4. Speichern, 5–30 Min warten bis DNS propagated

### Verifikation

```bash
# Auf lokalem Rechner prüfen:
dig staging.levcon.ai +short
# Erwartet: 87.106.25.91

# Alternativ:
nslookup staging.levcon.ai
```

---

## 4. GitHub Secrets (bereits vorhanden)

Das Staging-Deployment verwendet **dieselben GitHub Secrets** wie Production, da es auf denselben VPS deployt:

| Secret | Wert | Verwendung |
|--------|------|------------|
| `VPS_HOST` | `87.106.25.91` | VPS-IP |
| `VPS_USER` | `root` (oder dein Deploy-User) | SSH-User |
| `VPS_SSH_KEY` | (private SSH-Key, multi-line) | SSH-Auth |
| `VPS_PORT` | `22` (oder dein SSH-Port) | SSH-Port |

**Keine separaten Staging-Secrets nötig** — Staging und Production sind auf demselben VPS.

---

## 5. VPS-Setup (Einmalig)

### Voraussetzungen

- ✅ Production ist deployed (deploy.sh wurde ausgeführt)
- ✅ DNS: `staging.levcon.ai → 87.106.25.91`
- ✅ GitHub Branch `staging` existiert (siehe Abschnitt 6)

### Setup ausführen

```bash
# Auf dem VPS einloggen
ssh root@87.106.25.91

# Staging-Repo klonen (branch: staging)
cd /var/www
git clone --branch staging https://github.com/LEVCON-AT/official.git levcon-staging
cd levcon-staging

# Setup-Skript ausführen
sudo bash deploy/staging/vps-setup-staging.sh
```

Das Skript macht alles automatisch:
- Klont Repo nach `/var/www/levcon-staging` (branch staging)
- Erstellt `.env` aus Template mit eigenem Staging-API-Key
- Baut Next.js mit `NEXT_PUBLIC_ENVIRONMENT=staging`
- Erstellt Staging-DB (`levcon-staging.db`)
- Richtet systemd-Service `levcon-staging` ein (Port 3003)
- Holt SSL-Zertifikat für `staging.levcon.ai`
- Konfiguriert nginx für `staging.levcon.ai`
- Startet alles

### Nach dem Setup

1. **SMTP konfigurieren** (optional für Staging):
   ```bash
   nano /var/www/levcon-staging/.env
   # SMTP_PASS eintragen ODER SMTP_DISABLED=true belassen
   systemctl restart levcon-staging
   ```

2. **Staging-API-Key notieren** (wird am Ende des Setup-Skripts ausgegeben):
   ```
   Staging API-Key (für Admin-Panel): <64-char-hex-string>
   ```

3. **Staging im Browser testen:**
   - https://staging.levcon.ai
   - Roter "STAGING" Banner oben sollte sichtbar sein
   - `curl -I https://staging.levcon.ai/` → `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`
   - https://staging.levcon.ai/robots.txt → `Disallow: /`

---

## 6. GitHub Branch `staging` anlegen

### Option A: Branch lokal erstellen & pushen

```bash
# Auf lokalem Rechner
cd pfad/zum/levcon-repo
git checkout main
git pull origin main

# Staging-Branch aus main erstellen
git checkout -b staging
git push origin staging

# Branch als "protected" markieren (in GitHub UI)
```

### Option B: Über GitHub UI

1. GitHub → Repository → Branches
2. "New branch" → Name: `staging` → Source: `main`
3. Create branch

### Erster Staging-Deploy

Nachdem der Branch existiert und der `staging` Branch auf den aktuellen Stand von `main` ist:

1. Push irgendwas auf `staging` (z.B. die Staging-Files aus diesem Setup)
2. GitHub Actions → "Deploy Staging to VPS" wird automatisch getriggert
3. Warte bis Deploy erfolgreich
4. Prüfe https://staging.levcon.ai

---

## 7. Test-Workflow (Wie man Staging nutzt)

### Szenario: Neue Feature entwickeln

```bash
# 1. Feature-Branch aus staging
git checkout staging
git pull origin staging
git checkout -b feature/neues-feature

# 2. Entwickeln, committen
git add .
git commit -m "feat: neues feature"

# 3. Nach staging pushen
git push origin feature/neues-feature

# 4. PR auf GitHub: feature/neues-feature → staging
#    → Review → Merge → Auto-Deploy auf staging.levcon.ai
```

### Szenario: QA auf Staging

1. Öffne https://staging.levcon.ai
2. Prüfe:
   - ✅ Roter STAGING-Banner sichtbar
   - ✅ Alle Panels funktionieren
   - ✅ Newsletter-Signup (Mails werden NICHT versendet, SMTP_DISABLED=true)
   - ✅ Admin-Panel: https://staging.levcon.ai/ai-news?admin=<STAGING_API_KEY>
   - ✅ robots.txt zeigt `Disallow: /`
   - ✅ Header `X-Robots-Tag: noindex, nofollow`

### Szenario: Staging → Production

Wenn Staging OK:

```bash
# 1. PR auf GitHub: staging → main
# 2. Review → Merge → Auto-Deploy auf levcon.ai (Production)
# 3. QA auf Production
```

---

## 8. CI/CD Pipeline Details

### Production (`deploy.yml`)

- **Trigger:** Push auf `main`
- **Concurrency:** `deploy-vps` (kein paralleler Production-Deploy)
- **Secrets:** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`
- **Skript:** `deploy/scripts/vps-update.sh`
- **Health-Check:** `https://levcon.ai/` muss 200 zurückgeben

### Staging (`deploy-staging.yml`)

- **Trigger:** Push auf `staging`
- **Concurrency:** `deploy-staging-vps` (eigene Gruppe, kein Konflikt mit Production)
- **Secrets:** dieselben wie Production (gleicher VPS)
- **Skript:** `deploy/staging/vps-update-staging.sh`
- **Health-Check:** `https://staging.levcon.ai/` muss 200 zurückgeben + `X-Robots-Tag: noindex` Header prüfen

---

## 9. Staging-spezifische Features

### 9.1 StagingBanner

Roter Banner oben auf jeder Seite mit Text "STAGING · Test-Umgebung — nicht für die Öffentlichkeit".

**Aktivierung:** `NEXT_PUBLIC_ENVIRONMENT=staging` in `.env` (wird vom Setup-Skript automatisch gesetzt)

**Code:** `src/components/StagingBanner.tsx`

### 9.2 X-Robots-Tag Header

Staging-Responses enthalten `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` Header.

**Aktivierung:** `NEXT_PUBLIC_ENVIRONMENT=staging` in `.env`

**Code:** Doppelt abgesichert:
- `src/proxy.ts` (Application-Layer)
- `deploy/nginx/staging.levcon.ai.conf` (nginx-Layer, defense in depth)

### 9.3 Dynamic robots.txt

Staging: `User-agent: * / Disallow: /`
Production: `User-agent: * / Allow: / / Sitemap: https://levcon.ai/sitemap.xml`

**Code:** `src/app/robots.ts` (Next.js Metadata API)

### 9.4 SMTP deaktiviert

Staging versendet **keine** echten E-Mails an Subscriber. Stattdessen:
- `SMTP_DISABLED=true` in `.env`
- Subscribe-/Confirm-/Newsletter-API-Routen prüfen dieses Flag und skippen SMTP-Versand
- Logs zeigen "SMTP disabled in staging mode"

**Alternative:** Mailtrap.io für E-Mail-Testing in Staging (optional, nicht in .env Template konfiguriert)

### 9.5 Eigene SQLite-DB

- Production: `/var/www/levcon/db/levcon.db`
- Staging: `/var/www/levcon-staging/db/levcon-staging.db`

Völlig getrennt — Staging-Tests verändern niemals Production-Daten.

### 9.6 Eigener API-Key

- Production: `LEVCON_INTERNAL_API_KEY` in `/var/www/levcon/.env`
- Staging: `LEVCON_INTERNAL_API_KEY` in `/var/www/levcon-staging/.env` (anderer Wert!)

Admin-Panel für Staging: `https://staging.levcon.ai/ai-news?admin=<STAGING_API_KEY>`

---

## 10. Rollback / Notfall

### Staging-Build fehlgeschlagen

Das `vps-update-staging.sh` Skript macht automatisch Rollback:
- Backup von `.next/standalone` wird vor dem Build erstellt
- Bei Build-Fehler → Backup wird wiederhergestellt
- Staging läuft auf altem Build weiter

### Staging-Service manuell restarten

```bash
ssh root@87.106.25.91
systemctl restart levcon-staging
journalctl -u levcon-staging -f  # Logs ansehen
```

### Staging komplett zurücksetzen

```bash
ssh root@87.106.25.91
systemctl stop levcon-staging
rm -rf /var/www/levcon-staging
# Setup-Skript neu ausführen:
# (Production-Repo klonen, dann bash deploy/staging/vps-setup-staging.sh)
```

### Staging-DB zurücksetzen

```bash
ssh root@87.106.25.91
systemctl stop levcon-staging
rm /var/www/levcon-staging/db/levcon-staging.db
cd /var/www/levcon-staging
bun run db:push --accept-data-loss
chown -R www-data:www-data db
systemctl start levcon-staging
```

---

## 11. Backup-Strategie

### Production (bestehend)

- Cron: `0 3 * * *` — täglich 03:00 Uhr
- Pfad: `/var/backups/levcon/levcon-YYYYMMDD.db.gz`
- Retention: 30 Tage

### Staging (neu)

- Cron: `30 3 * * *` — täglich 03:30 Uhr (30 Min nach Production)
- Pfad: `/var/backups/levcon-staging/levcon-staging-YYYYMMDD.db.gz`
- Retention: 7 Tage (Staging-Daten sind entbehrlicher)

Beide Crons werden von `vps-setup-staging.sh` automatisch eingerichtet (`/etc/cron.d/levcon-staging-backup`).

---

## 12. Troubleshooting

### Problem: Staging-Banner nicht sichtbar

**Ursache:** `NEXT_PUBLIC_ENVIRONMENT` wurde nicht während des Builds gesetzt.

**Fix:**
```bash
# Auf VPS:
cd /var/www/levcon-staging
grep NEXT_PUBLIC_ENVIRONMENT .env
# Muss zeigen: NEXT_PUBLIC_ENVIRONMENT="staging"

# Wenn fehlt, hinzufügen:
echo 'NEXT_PUBLIC_ENVIRONMENT="staging"' >> .env

# Neubau nötig (NEXT_PUBLIC_* wird zur Build-Zeit gebakt):
bash deploy/staging/vps-update-staging.sh
```

### Problem: Staging in Google indexiert

**Ursache:** nginx oder Application-Header nicht korrekt gesetzt.

**Diagnose:**
```bash
curl -I https://staging.levcon.ai/
# Muss enthalten: X-Robots-Tag: noindex, nofollow, noarchive, nosnippet

curl https://staging.levcon.ai/robots.txt
# Muss zeigen: User-agent: * / Disallow: /
```

**Fix:** Falls Header fehlt → `systemctl reload nginx` + `systemctl restart levcon-staging`

### Problem: Staging-Deploy schlägt fehl in GitHub Actions

**Diagnose:**
1. GitHub → Actions → fehlgeschlagener Run → Logs ansehen
2. Auf VPS: `journalctl -u levcon-staging --no-pager -n 50`
3. Auf VPS: `tail -50 /var/log/nginx/staging.levcon.ai.error.log`

**Häufige Ursachen:**
- DNS noch nicht propagated (`dig staging.levcon.ai +short` prüfen)
- SSL-Zertifikat nicht erstellt (`/etc/letsencrypt/live/staging.levcon.ai/` prüfen)
- Port 3003 belegt (`ss -tln | grep 3003`)

### Problem: Staging-Newsletter geht an echte Subscriber

**Das darf NIEMALS passieren!** Verifiziere:

```bash
grep SMTP_DISABLED /var/www/levcon-staging/.env
# Muss zeigen: SMTP_DISABLED="true"
```

Falls `SMTP_DISABLED` fehlt oder `false` ist → SOFORT setzen + restart:
```bash
sed -i 's|^SMTP_DISABLED=.*|SMTP_DISABLED="true"|' /var/www/levcon-staging/.env
systemctl restart levcon-staging
```

---

## 13. File-Übersicht

### Neu erstellt

| File | Zweck |
|------|-------|
| `.github/workflows/deploy-staging.yml` | GitHub Actions Workflow für Staging |
| `deploy/staging/vps-setup-staging.sh` | Einmaliges VPS-Setup für Staging |
| `deploy/staging/vps-update-staging.sh` | Wiederkehrendes Update-Skript |
| `deploy/systemd/levcon-staging.service` | systemd-Service (Port 3003) |
| `deploy/nginx/staging.levcon.ai.conf` | nginx-Config für staging.levcon.ai |
| `deploy/.env.staging` | Env-Template (committed, keine Secrets) |
| `src/app/robots.ts` | Dynamic robots.txt (Next.js Metadata API) |
| `src/components/StagingBanner.tsx` | Visueller Staging-Hinweis |

### Geändert

| File | Änderung |
|------|----------|
| `src/proxy.ts` | X-Robots-Tag Header bei Staging |
| `src/components/LevconPage.tsx` | StagingBanner eingebunden |
| `src/app/globals.css` | StagingBanner CSS |
| `src/messages/de.json` + `en.json` | stagingBanner i18n keys |
| `public/robots.txt` | Gelöscht (durch `src/app/robots.ts` ersetzt) |

---

## 14. Quick-Reference

### Erste Inbetriebnahme (Owner)

```bash
# 1. DNS anlegen (IONOS)
#    A-Record: staging → 87.106.25.91

# 2. Auf lokalem Rechner: staging branch erstellen
git checkout main && git pull
git checkout -b staging && git push origin staging

# 3. Warten bis DNS propagated (5-30 Min)
dig staging.levcon.ai +short
# → 87.106.25.91

# 4. Auf VPS: Setup ausführen
ssh root@87.106.25.91
cd /var/www
git clone --branch staging https://github.com/LEVCON-AT/official.git levcon-staging
cd levcon-staging
sudo bash deploy/staging/vps-setup-staging.sh

# 5. Staging-API-Key notieren (wird vom Skript ausgegeben)

# 6. Testen
curl -I https://staging.levcon.ai/
# → HTTP 200 + X-Robots-Tag: noindex, nofollow
```

### Tägliche Nutzung

```bash
# Feature entwickeln
git checkout staging && git pull
git checkout -b feature/xyz
# ... entwickeln ...
git push origin feature/xyz
# → PR nach staging → Merge → Auto-Deploy

# QA auf https://staging.levcon.ai

# Wenn OK: PR staging → main → Auto-Deploy Production
```

### Staging-Admin-Panel

```
https://staging.levcon.ai/ai-news?admin=<STAGING_API_KEY>
```

---

*Bei Fragen: siehe `PROJECT-CONTEXT.md` oder `worklog.md` für Session-Historie.*

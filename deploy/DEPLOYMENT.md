# Levcon.ai — Deployment Guide

**VPS:** 87.106.25.91
**Domain:** levcon.ai (Next.js) + engine.levcon.at (n8n)
**GitHub Repo:** https://github.com/LEVCON-AT/official

---

## Architektur

```
GitHub (main branch)
    │
    │ Push
    ↓
GitHub Actions Workflow (.github/workflows/deploy.yml)
    │
    │ SSH
    ↓
VPS (87.106.25.91)
    │
    ├── /var/www/levcon/         ← Next.js App
    │   ├── .env                 ← Production env (manuell gepflegt)
    │   ├── .next/standalone/    ← Build-Output
    │   ├── db/levcon.db         ← SQLite
    │   └── deploy/              ← Deploy-Scripts (aus git)
    │
    ├── nginx                    ← Reverse Proxy + SSL
    │   ├── levcon.ai.conf       ← Next.js
    │   └── engine.levcon.at.conf ← n8n
    │
    ├── systemd                  ← Process Manager
    │   └── levcon.service       ← Next.js Service
    │
    └── Docker                   ← n8n Container
        └── n8n                  ← Port 5678 (intern)
```

---

## 1. Einmaliges Initial-Setup (manuell)

### 1.1 SSH auf VPS
```bash
ssh root@87.106.25.91
```

### 1.2 Initial-Deployment-Skript ausführen
```bash
cd /tmp
git clone https://github.com/LEVCON-AT/official.git levcon-repo
cd levcon-repo
chmod +x deploy/scripts/deploy.sh
sudo bash deploy/scripts/deploy.sh
```

Das Skript macht alles:
- System-Update + Pakete installieren
- Node.js 20, Bun, nginx, certbot
- Firewall (UFW), Fail2ban
- Git-Clone nach `/var/www/levcon`
- `.env` erstellen (mit generiertem API-Key)
- DB anlegen, Next.js build
- nginx-Konfiguration + SSL (Let's Encrypt)
- systemd-Service
- Backup-Cron

### 1.3 .env anpassen
```bash
nano /var/www/levcon/.env
```

Folgende Werte ändern:
```
SMTP_PASS="dein-ionos-passwort"
ZAI_API_KEY="dein-z-ai-api-key"
```

Service neustarten:
```bash
systemctl restart levcon
```

### 1.4 Basic Auth für n8n (engine.levcon.at)
```bash
htpasswd -c /etc/nginx/.htpasswd.engine admin
# Passwort vergeben
systemctl reload nginx
```

### 1.5 n8n Workflows importieren
Siehe `deploy/n8n/README.md`.

---

## 2. GitHub Actions Auto-Deploy einrichten

Nach dem Initial-Setup kann jedes `git push` auf `main` automatisch deployen.

### 2.1 SSH-Key für GitHub erstellen

**Auf dem VPS:**
```bash
# Neuen SSH-Key nur für GitHub-Deploy erstellen
ssh-keygen -t ed25519 -C "github-actions@levcon.ai" -f ~/.ssh/github_deploy -N ""

# Public Key anzeigen (für authorized_keys)
cat ~/.ssh/github_deploy.pub

# Private Key anzeigen (für GitHub Secret)
cat ~/.ssh/github_deploy
```

### 2.2 Public Key zu authorized_keys hinzufügen
```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 2.3 GitHub Secrets konfigurieren

1. GitHub-Repo öffnen: https://github.com/LEVCON-AT/official
2. **Settings → Secrets and variables → Actions**
3. **"New repository secret"** für jeweils:

| Secret Name | Wert |
|---|---|
| `VPS_HOST` | `87.106.25.91` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | *(Inhalt der private key Datei `~/.ssh/github_deploy`)* |
| `VPS_PORT` | `22` (optional) |

**Wichtig für `VPS_SSH_KEY`:**
- Kompletten Inhalt der Private-Key-Datei kopieren, inklusive:
  ```
  -----BEGIN OPENSSH PRIVATE KEY-----
  ...
  -----END OPENSSH PRIVATE KEY-----
  ```

### 2.4 Workflow testen

1. Mache eine kleine Änderung im Repo (z.B. README.md)
2. Commit & Push auf `main`
3. Öffne: https://github.com/LEVCON-AT/official/actions
4. Der Workflow "Deploy to VPS" sollte automatisch starten
5. Nach ~2-3 Minuten: "✅ Health check passed"

### 2.5 Manueller Trigger (optional)

Falls du manuell deployen willst (ohne Push):
1. GitHub → Actions → "Deploy to VPS"
2. "Run workflow" → "Run workflow"

---

## 3. Wie das Auto-Deploy funktioniert

### 3.1 Workflow-Datei
`.github/workflows/deploy.yml` triggert bei jedem Push auf `main`.

### 3.2 VPS-Update-Script
`deploy/scripts/vps-update.sh` wird auf dem VPS ausgeführt und macht:

1. **Backup** des aktuellen Builds (für Rollback)
2. **git pull** (latest main)
3. **bun install** (Dependencies)
4. **db:push** (Schema-Updates)
5. **bun run build** (Next.js)
6. **Copy static files** (public + .next/static → standalone)
7. **Permissions** setzen
8. **nginx reload** (falls config geändert)
9. **systemctl restart levcon**
10. **Cleanup** Backups

### 3.3 Rollback-Verhalten
Falls der Build fehlschlägt:
- Backup wird automatisch wiederhergestellt
- Service läuft auf dem alten Build weiter
- GitHub Action schlägt fehl → du bekommst GitHub-Notification

---

## 4. Wartung

### 4.1 Logs anschauen
```bash
# Next.js
journalctl -u levcon -f

# Nginx
tail -f /var/log/nginx/levcon.ai.access.log
tail -f /var/log/nginx/levcon.ai.error.log

# n8n
docker logs n8n -f
```

### 4.2 Service manuell neustarten
```bash
systemctl restart levcon
systemctl reload nginx
docker restart n8n
```

### 4.3 DB Backup (automatisch)
Cron läuft täglich 03:00:
```bash
ls -la /var/backups/levcon/
```

### 4.4 SSL-Zertifikat erneuern
Passiert automatisch via systemd timer. Manuelles Testen:
```bash
certbot renew --dry-run
```

### 4.5 n8n aktualisieren
```bash
cd /pfad/zu/n8n-docker-compose
docker-compose pull
docker-compose up -d
```

---

## 5. Troubleshooting

### GitHub Action schlägt fehl: "Permission denied (publickey)"
- SSH-Key in GitHub Secret korrekt? (Kompletter Inhalt inkl. BEGIN/END)
- Public Key in `~/.ssh/authorized_keys` auf VPS?
- `ssh-keyscan` hat den Host-Key korrekt hinzugefügt?

### GitHub Action: "Build failed"
- Auf VPS einloggen, manuell bauen:
  ```bash
  cd /var/www/levcon
  bun run build
  ```
- Error-Output prüfen

### Service startet nicht
```bash
systemctl status levcon
journalctl -u levcon --no-pager -n 50
```

### Site nicht erreichbar
```bash
# Service läuft?
systemctl status levcon

# Nginx läuft?
systemctl status nginx

# SSL ok?
curl -vI https://levcon.ai/

# Ports offen?
ss -tln | grep -E '3000|443|80'
```

---

## 6. Sicherheits-Checkliste

- [x] UFW Firewall aktiv (nur SSH, HTTP, HTTPS)
- [x] Fail2ban aktiv
- [x] Auto Security Updates aktiviert
- [x] SSH-Key-basiertes Login (Passwort-Login deaktiviert empfohlen)
- [x] `.env` mit chmod 600 (nur Owner darf lesen)
- [x] HSTS aktiviert (1 Jahr + preload)
- [x] CSP Header gesetzt
- [x] SSL-Zertifikate automatisch erneuernd
- [x] DB-Backups täglich (30 Tage Retention)
- [x] systemd Service mit Security-Hardening
- [x] n8n hinter Basic Auth (zusätzlich zu n8n-Login)

**Empfohlene zusätzliche Schritte:**
- [ ] SSH-Port ändern (22 → z.B. 2222) gegen Bots
- [ ] `PermitRootLogin prohibit-password` in sshd_config
- [ ] Offsite-Backups (z.B. rsync zu Backup-Server)
- [ ] Monitoring (Uptime-Robot o.ä.)

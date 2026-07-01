# VPS Setup — AI News

**Status:** Draft v1.0
**Last Updated:** 2025-06-25

Diese Anleitung dokumentiert das vollständige VPS-Setup für den AI News-Betrieb.

---

## 1. Voraussetzungen

### 1.1 Bereitgestellt durch Owner
- [ ] VPS mit root/sudo-Zugriff
- [ ] Domain `levcon.ai` mit DNS-Kontrolle
- [ ] SSH-Zugang für Deployment
- [ ] E-Mail-Postfach für SMTP-Versand (z.B. `news@levcon.ai`)
- [ ] LinkedIn-Account (Personal oder Organization) für API-Access

### 1.2 Bereitgestellt durch Code
- Next.js-Standalone-Build (`output: "standalone"`)
- Prisma-Schema mit AI News-Modellen
- n8n-Workflow-JSONs (ready-to-import)
- HTML-Templates für Newsletter

---

## 2. System-Voraussetzungen (VPS)

### 2.1 Empfohlene Specs
- **OS:** Ubuntu 22.04 LTS oder Debian 12
- **RAM:** 2 GB minimum (4 GB empfohlen für n8n)
- **Disk:** 20 GB SSD
- **CPU:** 2 vCores

### 2.2 Erforderliche Dienste
- Node.js 20.x LTS
- Bun (für Next.js)
- SQLite3
- n8n (via Docker oder npm)
- Caddy (Reverse Proxy, bereits vorhanden)
- Postfix oder Exim (für SMTP — oder externer Dienst)

---

## 3. Setup-Schritte

### 3.1 System-Update
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git sqlite3 build-essential
```

### 3.2 Node.js 20 LTS installieren
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # v20.x.x
```

### 3.3 Bun installieren
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

### 3.4 Verzeichnisstruktur anlegen
```bash
sudo mkdir -p /var/lib/levcon
sudo mkdir -p /var/log/levcon
sudo mkdir -p /var/backups/levcon
sudo chown -R $USER:$USER /var/lib/levcon /var/log/levcon /var/backups/levcon
```

### 3.5 Projekt klonen
```bash
cd /var/www
git clone https://github.com/LEVCON-AT/official.git levcon
cd levcon
bun install
```

### 3.6 Environment-Datei anlegen
```bash
cp .env.example .env
nano .env
# Trage echte Werte ein (siehe ENV-TEMPLATE.md)
```

### 3.7 Datenbank initialisieren
```bash
bun run db:push
sqlite3 prisma/levcon.db ".tables"
```

### 3.8 Next.js Build
```bash
bun run build
# Standalone-Output in .next/standalone/
```

### 3.9 PM2 für Process-Management
```bash
sudo npm install -g pm2

# ecosystem.config.js (im Projekt-Root)
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'levcon',
    script: '.next/standalone/server.js',
    cwd: '/var/www/levcon',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
  }]
};
EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 4. n8n-Setup

### 4.1 Docker-Installation (empfohlen)
```bash
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
# Logout + Login für Group-Change
```

### 4.2 n8n via Docker-Compose
```bash
sudo mkdir -p /var/lib/n8n
sudo chown $USER:$USER /var/lib/n8n

cat > /var/lib/n8n/docker-compose.yml << 'EOF'
version: '3.8'

volumes:
  n8n_data:
    driver: local

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    restart: always
    ports:
      - "127.0.0.1:5678:5678"  # nur lokal, via Caddy nach außen
    environment:
      - N8N_HOST=n8n.levcon.ai
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.levcon.ai/
      - GENERIC_TIMEZONE=Europe/Vienna
      - N8N_ENCRYPTION_KEY=<siehe .env>
      - DB_TYPE=sqlite
      - DB_NAME=/data/database.sqlite
    volumes:
      - n8n_data:/data
      - /var/lib/n8n:/files
EOF

cd /var/lib/n8n
docker-compose up -d
docker-compose logs -f n8n
```

### 4.3 n8n via Caddy erreichbar machen
Caddyfile ergänzen:
```
n8n.levcon.ai {
    reverse_proxy 127.0.0.1:5678
    basicauth {
        admin <bcrypt-hash>
    }
}
```

### 4.4 Credentials in n8n anlegen
Für jeden Workflow werden Credentials benötigt:

| Credential | Typ | Verwendung |
|---|---|---|
| `Levcon API Key` | Header Auth | Interner API-Aufruf (Schutz gegen externen Zugriff) |
| `z-ai LLM` | HTTP Header Auth | z-ai-web-dev-sdk Aufrufe |
| `LinkedIn OAuth2` | OAuth2 API | LinkedIn Posts |
| `SMTP Levcon` | SMTP | Newsletter-Versand |

**Setup-Schritte:**
1. n8n-UI öffnen (https://n8n.levcon.ai)
2. Settings → Credentials → Add Credential
3. Für jeden Typ anlegen, Werte aus `.env` eintragen

### 4.5 Workflows importieren
1. n8n-UI → Workflows → Import from File
2. Hochladen der JSON-Dateien aus `ai-news/n8n-workflows/`
3. Credentials zuweisen
4. Aktivieren (toggle inaktiv → aktiv)

---

## 5. SMTP-Setup

### 5.1 Option A: Postfix auf VPS
```bash
sudo apt install -y postfix mailutils
# Konfiguration: "Internet Site"
# System mail name: levcon.ai
```

### 5.2 Option B: Externer Dienst (empfohlen)
- **Mailgun** (kostenlos bis 5k/Mails/Monat)
- **SendGrid** (kostenlos bis 100/Mails/Tag)
- **Amazon SES** (sehr günstig)

Vorteil externer Dienst: Bessere Deliverability, einfaches SPF/DKIM-Setup.

### 5.3 DNS-Records (für levcon.ai)

**SPF (TXT):**
```
levcon.ai.   IN  TXT  "v=spf1 include:_spf.mailgun.org -all"
```

**DKIM (TXT):**
```
mg.levcon.ai.  IN  TXT  "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBA..."
```

**DMARC (TXT):**
```
_dmarc.levcon.ai.  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@levcon.ai"
```

**MX für Subdomain (bei Mailgun):**
```
mg.levcon.ai.  IN  MX  10 mxa.mailgun.org
mg.levcon.ai.  IN  MX  10 mxb.mailgun.org
```

### 5.4 Test-Versand
```bash
echo "Test" | mail -s "Levcon SMTP Test" test@levcon.ai
# Log prüfen:
sudo tail -f /var/log/mail.log
```

---

## 6. LinkedIn-API-Setup

### 6.1 LinkedIn App erstellen
1. https://www.linkedin.com/developers/apps → Create App
2. App-Name: "Levcon AI News"
3. LinkedIn Page: Levcon-Unternehmensseite verknüpfen
4. App-Typ: "Marketing Developer Platform"

### 6.2 Products aktivieren
- "Share on LinkedIn" — für Posts
- "Sign In with LinkedIn using OpenID Connect" — für Auth

### 6.3 OAuth2-Credentials
- **Client ID:** `<<LINKEDIN_CLIENT_ID>>`
- **Client Secret:** `<<LINKEDIN_CLIENT_SECRET>>`
- **Redirect URI:** `https://n8n.levcon.ai/rest/oauth2-credential/callback`

### 6.4 Scopes
- `w_member_social` — Post als Mitglied
- `r_organization_social` — Lesen von Organization-Posts
- `w_organization_social` — Post als Organization (falls gewünscht)

### 6.5 Access Token
n8n LinkedIn-Node führt OAuth2-Flow durch. Nach einmaligem Authorize ist Token hinterlegt (auto-refresh).

Siehe `docs/LINKEDIN-API.md` für detaillierte Schritte.

---

## 7. Backups

### 7.1 Daily SQLite-Dump (Cron)
```bash
# /etc/cron.d/levcon-backup
0 3 * * * root sqlite3 /var/lib/levcon/levcon.db ".dump" | gzip > /var/backups/levcon/levcon-$(date +\%Y\%m\%d).db.gz && find /var/backups/levcon -name "levcon-*.db.gz" -mtime +30 -delete
```

### 7.2 Offsite-Backup (optional)
```bash
# Wöchentliches rsync zu Backup-Server
0 4 * * 0 root rsync -avz /var/backups/levcon/ backup@remote:/backups/levcon/
```

### 7.3 n8n-Workflow-Backups
- Workflows sind in Git versioniert
- Nach jeder Workflow-Änderung in n8n-UI: Export als JSON → commit

---

## 8. Monitoring

### 8.1 Health-Check
```bash
# Cron alle 5 Min
*/5 * * * * root curl -fsS -m 10 https://levcon.ai/api/health || echo "Levcon DOWN" | mail -s "Alert" ops@levcon.ai
```

### 8.2 n8n-Workflow-Status
- n8n-UI: Executions-Tab
- Bei 3 aufeinanderfolgenden Fehlern: Alert via Error-Trigger-Workflow

### 8.3 Log-Aggregation (optional)
- PM2-Logs: `/var/log/levcon/`
- n8n-Logs: `docker logs n8n`
- Optional: Loki + Grafana für zentrale Logs

---

## 9. Security-Hardening

### 9.1 Firewall (UFW)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 9.2 SSH-Hardening
- Key-basiertes Login (Passwort-Login deaktivieren)
- `PermitRootLogin no` in `/etc/ssh/sshd_config`
- Optional: `Port 2222` statt 22

### 9.3 Fail2Ban
```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

### 9.4 Automatische Security-Updates
```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 10. Deployment-Workflow

### 10.1 Code-Update
```bash
cd /var/www/levcon
git pull origin main
bun install
bun run db:push  # bei Schema-Änderungen
bun run build
pm2 restart levcon
```

### 10.2 n8n-Workflow-Update
1. Workflow in n8n-UI öffnen
2. Neues JSON importieren (überschreibt)
3. Credentials erneut zuweisen
4. Speichern + Aktivieren

### 10.3 Rollback
- Code: `git checkout <previous-commit> && bun run build && pm2 restart levcon`
- DB: `sqlite3 levcon.db < backup.sql`

---

## 11. Owner-Checklist (vor Go-Live)

- [ ] VPS bereit, SSH-Zugang konfiguriert
- [ ] DNS levcon.ai zeigt auf VPS
- [ ] DNS n8n.levcon.ai zeigt auf VPS
- [ ] SSL-Zertifikate via Caddy auto-issued
- [ ] LinkedIn App erstellt, Credentials in n8n hinterlegt
- [ ] SMTP-Dienst konfiguriert (Mailgun o.ä.)
- [ ] SPF/DKIM/DMARC DNS-Records gesetzt
- [ ] .env mit echten Werten auf VPS
- [ ] n8n-Workflows importiert & aktiviert
- [ ] Test-Signup via Website erfolgreich
- [ ] Test-Newsletter empfangen
- [ ] Test-LinkedIn-Post veröffentlicht
- [ ] Backup-Cron aktiv
- [ ] Health-Check-Alert eingerichtet

---

## 12. Troubleshooting

### 12.1 n8n-Workflow läuft nicht
```bash
# Logs
docker logs n8n --tail 100

# Executions in n8n-UI prüfen
# Credentials-Verbindung testen (n8n → Credential → Test)
```

### 12.2 Newsletter kommt nicht an
- Spam-Ordner prüfen
- Mailgun-Logs prüfen
- SPF/DKIM via `mail-tester.com` verifizieren

### 12.3 LinkedIn-Post fehlschlägt
- Token abgelaufen? In n8n re-authorisieren
- Rate-Limit? Max 150 Posts/Tag pro Member
- Content-Policy verletzt? LinkedIn API-Fehlermeldung prüfen

### 12.4 DB-Lock
```bash
sqlite3 /var/lib/levcon/levcon.db "PRAGMA journal_mode=WAL;"
```

---

## 13. Wartungs-Routinen

| Aufgabe | Frequenz | Wer |
|---|---|---|
| DB-Backup prüfen | Täglich | Cron (autom.) |
| n8n-Workflow-Logs | Täglich | Owner |
| SQLite-VACUUM | Wöchentlich | Cron |
| Security-Updates | Wöchentlich | `unattended-upgrades` |
| Workflow-Retest | Monatlich | Owner |
| Newsletter-Stats prüfen | Monatlich | Owner |
| DB-Größe prüfen | Quartalsweise | Owner |
| Archiv-Aufräum-Job | Jährlich | Owner (oder n8n-Cron) |

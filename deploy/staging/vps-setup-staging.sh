#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  LEVCON.AI STAGING — VPS SETUP SCRIPT (ONE-TIME)
#  Erstellt staging.levcon.ai vollständig auf dem VPS
# ═══════════════════════════════════════════════════════════════
#
#  Ausführung:
#    ssh root@87.106.25.91
#    cd /var/www/levcon
#    git pull origin main  # holt dieses Skript
#    bash deploy/staging/vps-setup-staging.sh
#
#  Voraussetzungen (siehe Preflight-Skript):
#  ✅ DNS: staging.levcon.ai → 87.106.25.91 (CHECKED)
#  ✅ Production läuft unter /var/www/levcon (CHECKED, b08a759)
#  ✅ /var/www/levcon-staging existiert nicht (CHECKED)
#  ✅ Port 3006 frei (Preflight zeigte 3003 belegt durch neonfall, 3006 frei)
#  ✅ Bun 1.3.14, Node v22.23.1, Git 2.43.0, nginx 1.24.0, certbot 2.9.0
#  ✅ www-data UID 33 existiert
#  ✅ UFW: Port 80+443 offen
#  ✅ SSL-Cert für staging.levcon.ai fehlt noch → wird beantragt
#
#  Was dieses Skript macht:
#  1. Git Remote URL für Production auf SSH umstellen (FIX für GH Actions)
#  2. Repo nach /var/www/levcon-staging klonen (branch: staging, SSH)
#  3. .env aus Template erstellen (mit echten Staging-Werten)
#  4. Dependencies installieren
#  5. Prisma DB push (erstellt levcon-staging.db)
#  6. Next.js Build (mit NEXT_PUBLIC_ENVIRONMENT=staging)
#  7. systemd Service levcon-staging einrichten (Port 3006)
#  8. nginx Site für staging.levcon.ai installieren
#  9. SSL-Zertifikat via certbot --standalone beantragen
#  10. Services starten
#  11. Backup-Cron einrichten
#  12. Verifikation
#
#  WICHTIG: Skript NIEMALS mit sudo ausführen — muss als root laufen!
#  Es wird keine Prompts geben (DEBIAN_FRONTEND=noninteractive).

set -e  # Abbruch bei Fehler

# Non-interactive mode für CI/CD-Kompatibilität
export DEBIAN_FRONTEND=noninteractive
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  LEVCON.AI — STAGING SETUP${NC}"
echo -e "${GREEN}  $(date)${NC}"
echo -e "${GREEN}  Hostname: $(hostname)${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

# ── 0. PRE-FLIGHT CHECKS ───────────────────────────────────────
echo -e "\n${BLUE}[0] Pre-flight checks...${NC}"

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Dieses Skript muss als root ausgeführt werden.${NC}"
   exit 1
fi

# Production muss vorhanden sein
if [ ! -d "/var/www/levcon" ]; then
    echo -e "${RED}Production /var/www/levcon fehlt!${NC}"
    echo -e "${YELLOW}Bitte zuerst deploy/scripts/deploy.sh ausführen.${NC}"
    exit 1
fi

# Staging darf noch nicht existieren
if [ -d "/var/www/levcon-staging" ]; then
    echo -e "${RED}/var/www/levcon-staging existiert bereits!${NC}"
    echo -e "${YELLOW}Falls Neu-Setup gewünscht: sudo rm -rf /var/www/levcon-staging zuerst${NC}"
    exit 1
fi

# Port 3006 muss frei sein
if ss -tln | grep -q ':3006 '; then
    echo -e "${RED}Port 3006 ist belegt!${NC}"
    ss -tln | grep ':3006'
    echo -e "${YELLOW}Bitte anderen Port wählen oder Prozess beenden.${NC}"
    exit 1
fi

# DNS muss korrekt sein
PUBLIC_IP=$(curl -sS --max-time 5 https://api.ipify.org 2>/dev/null || echo "")
STAGING_IP=$(dig +short staging.levcon.ai 2>/dev/null | head -1)
if [ -z "$STAGING_IP" ] || [ "$STAGING_IP" != "$PUBLIC_IP" ]; then
    echo -e "${RED}DNS-Fehler: staging.levcon.ai → $STAGING_IP (erwartet: $PUBLIC_IP)${NC}"
    echo -e "${YELLOW}Bitte A-Record anlegen: staging → $PUBLIC_IP${NC}"
    exit 1
fi
echo -e "${GREEN}  ✅ DNS korrekt: staging.levcon.ai → $PUBLIC_IP${NC}"

echo -e "${GREEN}  ✅ Port 3006 frei${NC}"
echo -e "${GREEN}  ✅ Production läuft${NC}"
echo -e "${GREEN}  ✅ /var/www/levcon-staging existiert nicht${NC}"

# ── 1. PRODUCTION GIT REMOTE URL AUF SSH UMSTELLEN (FIX!) ────
echo -e "\n${BLUE}[1] Production Git Remote URL auf SSH umstellen...${NC}"

cd /var/www/levcon
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null)
echo "  Aktuelle Remote URL: $CURRENT_REMOTE"

if echo "$CURRENT_REMOTE" | grep -q "^https://github.com"; then
    echo -e "${YELLOW}  ⚠ HTTPS Remote gefunden — das war der Grund für den fehlgeschlagenen GitHub Actions Run!${NC}"
    git remote set-url origin git@github.com:LEVCON-AT/official.git
    echo -e "${GREEN}  ✅ Remote URL auf SSH umgestellt:${NC}"
    echo "    $(git remote get-url origin)"

    # Test: Fetch muss ohne Username-Prompt funktionieren
    if git fetch origin main 2>&1; then
        echo -e "${GREEN}  ✅ git fetch origin main erfolgreich (SSH-Auth klappt)${NC}"
    else
        echo -e "${RED}  ❌ git fetch fehlgeschlagen! SSH-Keys prüfen.${NC}"
        echo -e "${YELLOW}  Lösung: SSH-Key bei GitHub als Deploy Key hinterlegen${NC}"
        echo -e "${YELLOW}  Siehe: https://github.com/LEVCON-AT/official/settings/keys${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}  ✅ Remote ist bereits SSH (oder kein HTTPS)${NC}"
fi

# ── 2. STAGING REPO KLONEN (BRANCH: staging, SSH) ─────────────
echo -e "\n${BLUE}[2] Clone repo to /var/www/levcon-staging (staging branch)...${NC}"

cd /var/www
git clone --branch staging git@github.com:LEVCON-AT/official.git levcon-staging
cd /var/www/levcon-staging

# Fix "dubious ownership" warning
git config --global --add safe.directory /var/www/levcon-staging
git config --add safe.directory /var/www/levcon-staging

echo -e "${GREEN}  ✅ Repo geklont (branch: staging)${NC}"
echo "  CWD: $(pwd)"
echo "  Commit: $(git log --oneline -1)"
echo "  Remote: $(git remote get-url origin)"

# ── 3. ENVIRONMENT FILE ERSTELLEN ─────────────────────────────
echo -e "\n${BLUE}[3] Environment file erstellen...${NC}"

# Kopiere Template
cp deploy/.env.staging .env

# Generiere eigenen Staging-API-Key (anders als Production!)
INTERNAL_KEY=$(openssl rand -hex 32)
sed -i "s/CHANGE_ME_TO_32_CHARS_RANDOM_STAGING/$INTERNAL_KEY/g" .env

# Setze korrekte DATABASE_URL (Staging-DB!)
VPS_DB_URL="file:/var/www/levcon-staging/db/levcon-staging.db"
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$VPS_DB_URL\"|" .env

# Setze NEXT_PUBLIC_SITE_URL
sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=\"https://staging.levcon.ai\"|" .env

# NEXT_PUBLIC_ENVIRONMENT MUSS 'staging' sein
if grep -q "^NEXT_PUBLIC_ENVIRONMENT=" .env; then
    sed -i "s|^NEXT_PUBLIC_ENVIRONMENT=.*|NEXT_PUBLIC_ENVIRONMENT=\"staging\"|" .env
else
    echo 'NEXT_PUBLIC_ENVIRONMENT="staging"' >> .env
fi

# Setze SMTP_HOST korrekt (ionos.de, nicht ionos.at)
sed -i "s|^SMTP_HOST=.*|SMTP_HOST=\"smtp.ionos.de\"|" .env

# Setze SMTP_USER korrekt
sed -i "s|^SMTP_USER=.*|SMTP_USER=\"admin@levcon.at\"|" .env

# SMTP_PASS leer lassen (SMTP_DISABLED=true ist default)
# Falls echter SMTP-Versand aus Staging gewünscht: hier manuell eintragen

# CONTACT_EMAIL für Staging
sed -i "s|^CONTACT_EMAIL=.*|CONTACT_EMAIL=\"hello@levcon.ai\"|" .env

# Setze PORT (3006, andere Ports 3003-3005 sind durch andere Services belegt)
if grep -q "^PORT=" .env; then
    sed -i "s|^PORT=.*|PORT=\"3006\"|" .env
else
    echo 'PORT="3006"' >> .env
fi

chmod 600 .env

echo -e "${GREEN}  ✅ .env erstellt aus Template${NC}"
echo -e "${YELLOW}  ⚠ SMTP_DISABLED=true (Staging versendet keine echten Mails)${NC}"
echo -e "${YELLOW}  Für E-Mail-Testing: nano /var/www/levcon-staging/.env → SMTP_DISABLED=false + SMTP_PASS eintragen${NC}"
echo ""
echo -e "${BLUE}  Staging API-Key (für Admin-Panel, bitte notieren):${NC}"
echo -e "${GREEN}  $INTERNAL_KEY${NC}"
echo ""

# ── 4. DATABASE DIRECTORY ──────────────────────────────────────
echo -e "\n${BLUE}[4] Database directory erstellen...${NC}"

mkdir -p db
chown -R www-data:www-data db
chmod 755 db

echo -e "${GREEN}  ✅ db/ Verzeichnis erstellt${NC}"

# ── 5. DEPENDENCIES INSTALLIEREN ───────────────────────────────
echo -e "\n${BLUE}[5] Dependencies installieren...${NC}"

cd /var/www/levcon-staging
bun install
echo -e "${GREEN}  ✅ Dependencies installiert${NC}"

# ── 6. PRISMA DB PUSH (erstellt Staging-DB) ───────────────────
echo -e "\n${BLUE}[6] Prisma DB push (erstellt Staging-DB)...${NC}"

echo "  DATABASE_URL in .env: $(grep '^DATABASE_URL=' .env | head -1)"

# Prisma-Engines brauchen Execute-Rechte VOR db:push
chmod +x node_modules/@prisma/engines/* 2>/dev/null || true
chmod +x node_modules/.bin/* 2>/dev/null || true

bun run db:push --accept-data-loss 2>&1 || bun run db:push 2>&1

# DB-Berechtigungen korrigieren
if [ -f "db/levcon-staging.db" ]; then
    echo -e "${GREEN}  ✅ Staging-DB erstellt: $(ls -la db/levcon-staging.db | awk '{print $5}') bytes${NC}"
    chown www-data:www-data db/levcon-staging.db
    chmod 664 db/levcon-staging.db
else
    echo -e "${RED}  ❌ Staging-DB wurde nicht erstellt!${NC}"
    echo "  Prüfe .env DATABASE_URL: $(grep '^DATABASE_URL=' .env)"
    exit 1
fi

# ── 7. NEXT.JS BUILD (mit Staging-Env) ─────────────────────────
echo -e "\n${BLUE}[7] Next.js build (NEXT_PUBLIC_ENVIRONMENT=staging)...${NC}"

# WICHTIG: NEXT_PUBLIC_* Variablen müssen WÄHREND des Builds gesetzt sein,
# weil Next.js sie in den Client-Bundle backt.
export NEXT_PUBLIC_ENVIRONMENT="staging"
export NEXT_PUBLIC_SITE_URL="https://staging.levcon.ai"

bun run build

echo -e "${GREEN}  ✅ Build erfolgreich${NC}"

# ── 8. STANDALONE SERVER FILES ─────────────────────────────────
echo -e "\n${BLUE}[8] Copy standalone files...${NC}"

cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# Cache-Verzeichnisse anlegen
mkdir -p .next/standalone/.next/cache
mkdir -p .next/cache

chown -R www-data:www-data /var/www/levcon-staging

echo -e "${GREEN}  ✅ Static files kopiert${NC}"

# ── 9. SYSTEMD SERVICE ────────────────────────────────────────
echo -e "\n${BLUE}[9] Systemd service (levcon-staging, Port 3006)...${NC}"

# Service-File anpassen: Port 3006 statt 3003
cat > /etc/systemd/system/levcon-staging.service << 'EOF'
[Unit]
Description=Levcon.ai Next.js Application (STAGING)
Documentation=https://github.com/LEVCON-AT/official
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/levcon-staging/.next/standalone
EnvironmentFile=/var/www/levcon-staging/.env

Environment="HOSTNAME=0.0.0.0"
Environment="PORT=3006"
Environment="NODE_ENV=production"

ExecStart=/usr/bin/node /var/www/levcon-staging/.next/standalone/server.js

Restart=always
RestartSec=10

StandardOutput=journal
StandardError=journal
SyslogIdentifier=levcon-staging

MemoryMax=384M
CPUQuota=60%

NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ReadWritePaths=/var/www/levcon-staging
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable levcon-staging

echo -e "${GREEN}  ✅ systemd Service 'levcon-staging' installiert (Port 3006)${NC}"

# ── 10. NGINX SITE FÜR STAGING ────────────────────────────────
echo -e "\n${BLUE}[10] Nginx config für staging.levcon.ai installieren...${NC}"

# Nginx Config aus Repo kopieren (bereits mit Port 3006)
cp deploy/nginx/staging.levcon.ai.conf /etc/nginx/sites-available/staging.levcon.ai

# Sicherheits-Check: Port ist 3006 (falls alte Config im Repo)
sed -i 's/127.0.0.1:300[0-9]/127.0.0.1:3006/g' /etc/nginx/sites-available/staging.levcon.ai

# Symlink erstellen
ln -sf /etc/nginx/sites-available/staging.levcon.ai /etc/nginx/sites-enabled/staging.levcon.ai

# Test nginx config
if nginx -t 2>&1; then
    echo -e "${GREEN}  ✅ Nginx config OK${NC}"
else
    echo -e "${RED}  ❌ Nginx config test fehlgeschlagen!${NC}"
    exit 1
fi

# ── 11. SSL-ZERTIFIKAT BEANTRAGEN (certbot --standalone) ──────
echo -e "\n${BLUE}[11] SSL-Zertifikat für staging.levcon.ai beantragen...${NC}"

if [ -f "/etc/letsencrypt/live/staging.levcon.ai/fullchain.pem" ]; then
    echo -e "${YELLOW}  ℹ Zertifikat existiert bereits — überspringe Beantragung${NC}"
else
    echo -e "${YELLOW}  ⚠ Stoppe nginx kurzfristig für certbot --standalone...${NC}"
    echo -e "${YELLOW}  (Andere Sites sind ~30 Sek nicht erreichbar)${NC}"

    # Nginx stoppen
    systemctl stop nginx

    # Certbot standalone
    if certbot certonly --standalone \
        -d staging.levcon.ai \
        --email admin@levcon.at --agree-tos --no-eff-email --non-interactive; then
        echo -e "${GREEN}  ✅ SSL-Zertifikat beantragt${NC}"
    else
        echo -e "${RED}  ❌ Certbot fehlgeschlagen!${NC}"
        echo -e "${YELLOW}  Nginx wird wieder gestartet, aber ohne SSL${NC}"
        systemctl start nginx
        exit 1
    fi

    # Nginx wieder starten
    systemctl start nginx
    sleep 2
    echo -e "${GREEN}  ✅ Nginx wieder gestartet${NC}"
fi

# ── 12. SERVICES STARTEN ───────────────────────────────────────
echo -e "\n${BLUE}[12] Services starten...${NC}"

systemctl restart nginx
systemctl restart levcon-staging
sleep 3

# Verify Next.js Staging läuft
if systemctl is-active --quiet levcon-staging; then
    echo -e "${GREEN}  ✅ levcon-staging service aktiv${NC}"
else
    echo -e "${RED}  ❌ levcon-staging service nicht aktiv!${NC}"
    journalctl -u levcon-staging --no-pager -n 30
    exit 1
fi

# Verify Port 3006 lauscht
if ss -tln | grep -q ':3006'; then
    echo -e "${GREEN}  ✅ Port 3006 lauscht${NC}"
else
    echo -e "${RED}  ❌ Port 3006 nicht erreichbar${NC}"
    journalctl -u levcon-staging --no-pager -n 30
    exit 1
fi

# ── 13. BACKUP-CRON EINRICHTEN ─────────────────────────────────
echo -e "\n${BLUE}[13] Staging DB backup cron...${NC}"

mkdir -p /var/backups/levcon-staging

cat > /etc/cron.d/levcon-staging-backup << 'EOF'
# Levcon Staging DB Backup — täglich 03:30 (30 Min nach Production)
30 3 * * * root sqlite3 /var/www/levcon-staging/db/levcon-staging.db ".dump" | gzip > /var/backups/levcon-staging/levcon-staging-$(date +\%Y\%m\%d).db.gz && find /var/backups/levcon-staging -name "levcon-staging-*.db.gz" -mtime +7 -delete
EOF
chmod 644 /etc/cron.d/levcon-staging-backup

echo -e "${GREEN}  ✅ Backup-Cron installiert (täglich 03:30, 7 Tage Retention)${NC}"

# ── 14. VERIFIKATION ───────────────────────────────────────────
echo -e "\n${BLUE}[14] Verifikation...${NC}"

echo ""
echo -e "${BLUE}Test 1: Lokal (Port 3006)${NC}"
curl -sSI --max-time 5 http://127.0.0.1:3006/ | head -3

echo ""
echo -e "${BLUE}Test 2: Extern (https://staging.levcon.ai)${NC}"
curl -sSI --max-time 10 https://staging.levcon.ai/ | head -5

echo ""
echo -e "${BLUE}Test 3: X-Robots-Tag Header (sollte 'noindex, nofollow' sein)${NC}"
curl -sSI --max-time 10 https://staging.levcon.ai/ | grep -i "x-robots-tag" || echo "  ⚠ X-Robots-Tag nicht gefunden"

echo ""
echo -e "${BLUE}Test 4: robots.txt (sollte 'Disallow: /' sein)${NC}"
curl -sS --max-time 10 https://staging.levcon.ai/robots.txt | head -5

echo ""
echo -e "${BLUE}Test 5: StagingBanner in HTML (sollte 1+ Vorkommen sein)${NC}"
BANNER_COUNT=$(curl -sS --max-time 10 https://staging.levcon.ai/ | grep -c "staging-banner" 2>/dev/null || echo 0)
echo "  staging-banner in HTML: $BANNER_COUNT (erwartet: ≥1)"

echo ""
echo -e "${BLUE}Test 6: /api/ai-news/quality-report (sollte 401 sein)${NC}"
curl -sSI --max-time 10 https://staging.levcon.ai/api/ai-news/quality-report | head -3

echo ""
echo -e "${BLUE}Test 7: Health Check (HTTPS 200)${NC}"
if curl -sf https://staging.levcon.ai/ -o /dev/null; then
    echo -e "${GREEN}  ✅ Health check passed${NC}"
else
    echo -e "${RED}  ❌ Health check failed${NC}"
    journalctl -u levcon-staging --no-pager -n 20
    exit 1
fi

# ── 15. FINAL STATUS ───────────────────────────────────────────
echo ""
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  STAGING SETUP ERFOLGREICH! 🎉${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

echo ""
echo -e "${BLUE}Services:${NC}"
echo "  Production: $(systemctl is-active levcon) → https://levcon.ai (Port 3002)"
echo "  Staging:    $(systemctl is-active levcon-staging) → https://staging.levcon.ai (Port 3006)"
echo "  Nginx:      $(systemctl is-active nginx)"

echo ""
echo -e "${BLUE}URLs:${NC}"
echo "  Production:  https://levcon.ai"
echo "  Staging:     https://staging.levcon.ai"
echo "  n8n:         https://engine.levcon.at"

echo ""
echo -e "${BLUE}Staging-Admin-Panel:${NC}"
echo "  https://staging.levcon.ai/ai-news?admin=$INTERNAL_KEY"

echo ""
echo -e "${BLUE}Staging API-Key (bitte sicher speichern):${NC}"
echo "  $INTERNAL_KEY"

echo ""
echo -e "${BLUE}Nächste Schritte:${NC}"
echo "  1. Browser öffnen: https://staging.levcon.ai"
echo "     → Roter STAGING-Banner oben sichtbar"
echo "  2. Admin-Panel testen: URL oben im Browser öffnen"
echo "  3. GitHub Actions für Staging testen:"
echo "     → Beliebigen Commit auf staging-Branch pushen"
echo "     → deploy-staging.yml wird automatisch triggern"

echo ""
echo -e "${BLUE}Logs:${NC}"
echo "  Staging Next.js: journalctl -u levcon-staging -f"
echo "  Staging Nginx:   tail -f /var/log/nginx/staging.levcon.ai.error.log"

echo ""
echo -e "${BLUE}SMTP (falls E-Mail-Testing gewünscht):${NC}"
echo "  nano /var/www/levcon-staging/.env"
echo "  → SMTP_DISABLED=false setzen"
echo "  → SMTP_PASS eintragen (gleicher wie Production)"
echo "  → systemctl restart levcon-staging"

echo ""
echo -e "${GREEN}Fertig! 🎉${NC}"

#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  LEVCON.AI STAGING — VPS SETUP SCRIPT (ONE-TIME)
#  Ausführen als: root (auf dem VPS)
#  Aufruf: sudo bash deploy/staging/vps-setup-staging.sh
# ═══════════════════════════════════════════════════════════════
#
#  Dieses Skript richtet das Staging-Environment ein:
#  1. Klont das Repo nach /var/www/levcon-staging (branch: staging)
#  2. Erstellt .env aus Template (Owner muss Secrets eintragen)
#  3. Baut Next.js (Standalone)
#  4. Richtet systemd-Service levcon-staging ein (Port 3003)
#  5. Konfiguriert nginx für staging.levcon.ai
#  6. Holt SSL-Zertifikat für staging.levcon.ai
#  7. Startet alles
#
#  VORAUSSETZUNGEN:
#  - Production ist bereits deployed (deploy.sh wurde ausgeführt)
#  - DNS: staging.levcon.ai → 87.106.25.91 (Owner muss anlegen)
#  - Skript wird als root ausgeführt
#
#  WICHTIG: Staging greift NICHT auf Production-Daten zu!
#  - Eigene DB: /var/www/levcon-staging/db/levcon-staging.db
#  - Eigener Port: 3003 (Production: 3002)
#  - Eigener systemd-Service: levcon-staging
#  - Eigene .env mit eigenem API-Key

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  LEVCON.AI — STAGING SETUP${NC}"
echo -e "${GREEN}  $(date)${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

# ── 0. PRE-FLIGHT CHECKS ───────────────────────────────────────
echo -e "\n${YELLOW}[0] Pre-flight checks...${NC}"

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Dieses Skript muss als root ausgeführt werden.${NC}"
   exit 1
fi

# Check: Production muss bereits installiert sein (deploy.sh ausgeführt)
if [ ! -d "/var/www/levcon" ]; then
    echo -e "${RED}Production ist noch nicht installiert!${NC}"
    echo -e "${YELLOW}Bitte zuerst deploy.sh ausführen (siehe deploy/DEPLOYMENT.md).${NC}"
    exit 1
fi

# Check: Staging darf noch nicht existieren
if [ -d "/var/www/levcon-staging" ]; then
    echo -e "${RED}Staging-Verzeichnis existiert bereits: /var/www/levcon-staging${NC}"
    echo -e "${YELLOW}Falls Update gewünscht: vps-update-staging.sh verwenden.${NC}"
    echo -e "${YELLOW}Falls Neu-Installation: rm -rf /var/www/levcon-staging zuerst.${NC}"
    exit 1
fi

# Check: Bun installiert?
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Bun ist nicht installiert!${NC}"
    echo -e "${YELLOW}Bitte zuerst Production deployen (deploy.sh installiert Bun).${NC}"
    exit 1
fi

echo "OS: $(uname -a)"
echo "Hostname: $(hostname)"
echo "Bun: $(bun --version)"

# ── 1. PROJECT DIRECTORY & GIT CLONE (STAGING BRANCH) ─────────
echo -e "\n${YELLOW}[1] Clone repo to /var/www/levcon-staging (staging branch)...${NC}"

mkdir -p /var/www
cd /var/www

# Klonen mit staging branch
git clone --branch staging https://github.com/LEVCON-AT/official.git levcon-staging
cd /var/www/levcon-staging

# Fix "dubious ownership" warning
git config --global --add safe.directory /var/www/levcon-staging
git config --add safe.directory /var/www/levcon-staging

echo "  ✓ Repo geklont (branch: staging)"
echo "  CWD: $(pwd)"
echo "  Commit: $(git log --oneline -1)"

# ── 2. ENVIRONMENT FILE ────────────────────────────────────────
echo -e "\n${YELLOW}[2] Environment file...${NC}"

# .env aus Template erstellen
cp deploy/.env.staging .env

# Generiere eigenen Staging-API-Key (anders als Production!)
INTERNAL_KEY=$(openssl rand -hex 32)
sed -i "s/CHANGE_ME_TO_32_CHARS_RANDOM_STAGING/$INTERNAL_KEY/g" .env

# Setze korrekte DATABASE_URL (Staging-DB!)
VPS_DB_URL="file:/var/www/levcon-staging/db/levcon-staging.db"
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$VPS_DB_URL\"|" .env

# Setze NEXT_PUBLIC_SITE_URL
sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=\"https://staging.levcon.ai\"|" .env

# Setze NEXT_PUBLIC_ENVIRONMENT
if grep -q "^NEXT_PUBLIC_ENVIRONMENT=" .env; then
    sed -i "s|^NEXT_PUBLIC_ENVIRONMENT=.*|NEXT_PUBLIC_ENVIRONMENT=\"staging\"|" .env
else
    echo "NEXT_PUBLIC_ENVIRONMENT=\"staging\"" >> .env
fi

chmod 600 .env

echo "  ✓ .env erstellt aus Template"
echo -e "${YELLOW}  ⚠ Bitte SMTP_PASS eintragen (oder SMTP_DISABLED=true belassen):${NC}"
echo -e "${YELLOW}    nano /var/www/levcon-staging/.env${NC}"
echo -e "${YELLOW}  Staging API-Key: ${INTERNAL_KEY:0:16}...${NC}"

# ── 3. DATABASE DIRECTORY ──────────────────────────────────────
echo -e "\n${YELLOW}[3] Database directory...${NC}"

mkdir -p db
chown -R www-data:www-data db
chmod 755 db

# ── 4. INSTALL DEPENDENCIES ────────────────────────────────────
echo -e "\n${YELLOW}[4] Install dependencies...${NC}"

bun install

# ── 5. PRISMA DB PUSH (erstellt Staging-DB) ───────────────────
echo -e "\n${YELLOW}[5] Prisma DB push (erstellt Staging-DB)...${NC}"

echo "  DATABASE_URL in .env: $(grep '^DATABASE_URL=' .env | head -1)"

# Prisma-Engines brauchen Execute-Rechte
chmod +x node_modules/@prisma/engines/* 2>/dev/null || true
chmod +x node_modules/.bin/* 2>/dev/null || true

bun run db:push --accept-data-loss 2>&1 || bun run db:push 2>&1

# DB-Berechtigungen
if [ -f "db/levcon-staging.db" ]; then
    echo "  ✓ Staging-DB erstellt: $(ls -la db/levcon-staging.db | awk '{print $5}') bytes"
    chown www-data:www-data db/levcon-staging.db
    chmod 664 db/levcon-staging.db
else
    echo -e "${RED}  ✗ Staging-DB wurde nicht erstellt!${NC}"
    exit 1
fi

# ── 6. NEXT.JS BUILD ──────────────────────────────────────────
echo -e "\n${YELLOW}[6] Next.js build...${NC}"

# NEXT_PUBLIC_ENVIRONMENT muss während des Builds gesetzt sein
# (sonst wird der Wert nicht in den Client-Bundle gebaked)
export NEXT_PUBLIC_ENVIRONMENT="staging"
export NEXT_PUBLIC_SITE_URL="https://staging.levcon.ai"

bun run build

# ── 7. STANDALONE SERVER FILES ─────────────────────────────────
echo -e "\n${YELLOW}[7] Copy standalone files...${NC}"

cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# Cache-Verzeichnisse anlegen
mkdir -p .next/standalone/.next/cache
mkdir -p .next/cache

chown -R www-data:www-data /var/www/levcon-staging

# ── 8. SYSTEMD SERVICE ────────────────────────────────────────
echo -e "\n${YELLOW}[8] Systemd service...${NC}"

cp deploy/systemd/levcon-staging.service /etc/systemd/system/levcon-staging.service
systemctl daemon-reload
systemctl enable levcon-staging

# ── 9. SSL CERTIFICATE (staging.levcon.ai) ────────────────────
echo -e "\n${YELLOW}[9] SSL certificate for staging.levcon.ai...${NC}"

echo -e "${YELLOW}Hinweis: Stelle sicher, dass staging.levcon.ai auf 87.106.25.91 zeigt!${NC}"
echo -e "${YELLOW}Drücke ENTER zum Fortfahren...${NC}"
read

# nginx stoppen (certbot --standalone braucht Port 80)
systemctl stop nginx 2>/dev/null || true

if [ ! -f "/etc/letsencrypt/live/staging.levcon.ai/fullchain.pem" ]; then
    echo "Erstelle Zertifikat für staging.levcon.ai (via standalone)..."
    certbot certonly --standalone \
        -d staging.levcon.ai \
        --email admin@levcon.at --agree-tos --no-eff-email --non-interactive
else
    echo "  ✓ Zertifikat existiert bereits"
fi

# ── 10. NGINX CONFIGURATION ────────────────────────────────────
echo -e "\n${YELLOW}[10] Nginx configuration...${NC}"

mkdir -p /var/www/letsencrypt

cp deploy/nginx/staging.levcon.ai.conf /etc/nginx/sites-available/staging.levcon.ai
ln -sf /etc/nginx/sites-available/staging.levcon.ai /etc/nginx/sites-enabled/staging.levcon.ai

# Test config
if nginx -t 2>&1; then
    echo "  ✓ Nginx config OK"
else
    echo -e "${RED}  ✗ Nginx config test fehlgeschlagen${NC}"
    exit 1
fi

# ── 11. START SERVICES ─────────────────────────────────────────
echo -e "\n${YELLOW}[11] Start services...${NC}"

systemctl restart nginx
systemctl restart levcon-staging
sleep 3

# Verify Next.js Staging läuft
if systemctl is-active --quiet levcon-staging; then
    echo "  ✓ levcon-staging service aktiv"
else
    echo -e "${RED}  ✗ levcon-staging service nicht aktiv!${NC}"
    journalctl -u levcon-staging --no-pager -n 30
    exit 1
fi

# Verify Port 3003 lauscht
if ss -tln | grep -q ':3003'; then
    echo "  ✓ Port 3003 lauscht"
else
    echo -e "${RED}  ✗ Port 3003 nicht erreichbar — Staging Next.js läuft nicht${NC}"
    journalctl -u levcon-staging --no-pager -n 30
    exit 1
fi

# ── 12. STAGING DB BACKUP CRON ────────────────────────────────
echo -e "\n${YELLOW}[12] Staging DB backup cron...${NC}"

mkdir -p /var/backups/levcon-staging

cat > /etc/cron.d/levcon-staging-backup << 'EOF'
# Levcon Staging DB Backup — täglich 03:30 (30 Min nach Production)
30 3 * * * root sqlite3 /var/www/levcon-staging/db/levcon-staging.db ".dump" | gzip > /var/backups/levcon-staging/levcon-staging-$(date +\%Y\%m\%d).db.gz && find /var/backups/levcon-staging -name "levcon-staging-*.db.gz" -mtime +7 -delete
EOF
chmod 644 /etc/cron.d/levcon-staging-backup

# ── 13. FINAL STATUS ───────────────────────────────────────────
echo -e "\n${GREEN}═════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  STAGING SETUP ERFOLGREICH!${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}Status:${NC}"
systemctl status levcon-staging --no-pager | head -5
echo ""
systemctl status nginx --no-pager | head -5

echo -e "\n${YELLOW}URLs:${NC}"
echo "  Production: https://levcon.ai"
echo "  Staging:    https://staging.levcon.ai"
echo "  n8n:        https://engine.levcon.at"

echo -e "\n${YELLOW}WICHTIG: Noch zu erledigen:${NC}"
echo "  1. SMTP_PASS in /var/www/levcon-staging/.env eintragen (oder SMTP_DISABLED=true belassen)"
echo "     nano /var/www/levcon-staging/.env"
echo "  2. Nach .env-Änderung: systemctl restart levcon-staging"
echo "  3. Staging-QA: https://staging.levcon.ai im Browser öffnen"
echo "     → StagingBanner sollte oben sichtbar sein"
echo "     → robots.txt sollte 'Disallow: /' enthalten"
echo "  4. GitHub Branch Protection für 'staging' einrichten (siehe deploy/STAGING.md)"

echo -e "\n${YELLOW}Logs:${NC}"
echo "  Next.js Staging: journalctl -u levcon-staging -f"
echo "  Nginx Staging:   tail -f /var/log/nginx/staging.levcon.ai.error.log"

echo -e "\n${YELLOW}Staging API-Key (für Admin-Panel):${NC}"
echo "  $INTERNAL_KEY"

echo -e "\n${GREEN}Fertig! 🎉${NC}"

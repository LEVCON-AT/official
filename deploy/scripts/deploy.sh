#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  LEVCON.AI — VPS DEPLOYMENT SCRIPT
#  VPS: 87.106.25.91
#  Ausführen als: root (auf dem VPS)
# ═══════════════════════════════════════════════════════════════
#
#  Dieses Skript:
#  1. Installiert Node.js, nginx, certbot, git
#  2. Klont das Levcon-Repo
#  3. Richtet .env ein (Owner muss SMTP-Passwort eintragen)
#  4. Baut Next.js (Standalone)
#  5. Konfiguriert nginx + SSL (levcon.ai + engine.levcon.at)
#  6. Richtet systemd-Service ein
#  7. Startet alles
#
#  WICHTIG: Als root ausführen!
#  sudo bash deploy.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  LEVCON.AI — VPS DEPLOYMENT${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

# ── 0. PRE-FLIGHT CHECKS ───────────────────────────────────────
echo -e "\n${YELLOW}[0] Pre-flight checks...${NC}"

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Dieses Skript muss als root ausgeführt werden.${NC}"
   exit 1
fi

echo "OS: $(uname -a)"
echo "Hostname: $(hostname)"

# ── 1. SYSTEM UPDATE & PACKAGES ────────────────────────────────
echo -e "\n${YELLOW}[1] System update & packages...${NC}"

apt-get update -y
apt-get upgrade -y
apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    zip \
    nginx \
    certbot \
    python3-certbot-nginx \
    sqlite3 \
    build-essential \
    htop \
    ufw \
    fail2ban \
    unattended-upgrades

# ── 2. NODE.JS 20 LTS ──────────────────────────────────────────
echo -e "\n${YELLOW}[2] Node.js 20 LTS...${NC}"

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "Node: $(node --version)"
echo "npm: $(npm --version)"

# ── 3. BUN ──────────────────────────────────────────────────────
echo -e "\n${YELLOW}[3] Bun...${NC}"

if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    # Für alle User verfügbar machen
    ln -sf /root/.bun/bin/bun /usr/local/bin/bun
fi
echo "Bun: $(bun --version)"

# ── 4. FIREWALL (UFW) ──────────────────────────────────────────
echo -e "\n${YELLOW}[4] Firewall...${NC}"

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── 5. FAIL2BAN ────────────────────────────────────────────────
echo -e "\n${YELLOW}[5] Fail2ban...${NC}"

systemctl enable fail2ban
systemctl start fail2ban

# ── 6. AUTO SECURITY UPDATES ───────────────────────────────────
echo -e "\n${YELLOW}[6] Auto security updates...${NC}"

dpkg-reconfigure -plow unattended-upgrades

# ── 7. PROJECT DIRECTORY & GIT CLONE ───────────────────────────
echo -e "\n${YELLOW}[7] Project directory & git clone...${NC}"

mkdir -p /var/www
cd /var/www

if [ -d "levcon" ]; then
    echo "Verzeichnis existiert bereits — pull latest..."
    # Fix "dubious ownership" warning (root vs www-data)
    git config --global --add safe.directory /var/www/levcon
    cd levcon
    git config --add safe.directory /var/www/levcon
    git pull origin main
else
    git clone https://github.com/LEVCON-AT/official.git levcon
    cd levcon
fi

# ── 8. ENVIRONMENT FILE ────────────────────────────────────────
echo -e "\n${YELLOW}[8] Environment file...${NC}"

if [ ! -f ".env" ]; then
    cp deploy/.env.production .env
    # Generiere LEVCON_INTERNAL_API_KEY
    INTERNAL_KEY=$(openssl rand -hex 32)
    sed -i "s/CHANGE_ME_TO_32_CHARS_RANDOM/$INTERNAL_KEY/g" .env
    echo -e "${YELLOW}.env erstellt. Bitte SMTP_PASS und ZAI_API_KEY eintragen!${NC}"
    echo -e "${YELLOW}Editor: nano /var/www/levcon/.env${NC}"
else
    echo ".env existiert bereits — überspringe"
fi

chmod 600 .env

# ── 9. DATABASE DIRECTORY ──────────────────────────────────────
echo -e "\n${YELLOW}[9] Database directory...${NC}"

mkdir -p db
chown -R www-data:www-data db

# ── 10. INSTALL DEPENDENCIES ───────────────────────────────────
echo -e "\n${YELLOW}[10] Install dependencies...${NC}"

bun install

# ── 11. PRISMA DB PUSH ─────────────────────────────────────────
echo -e "\n${YELLOW}[11] Prisma DB push...${NC}"

bun run db:push

# ── 12. NEXT.JS BUILD ──────────────────────────────────────────
echo -e "\n${YELLOW}[12] Next.js build...${NC}"

bun run build

# ── 13. STANDALONE SERVER FILE ─────────────────────────────────
echo -e "\n${YELLOW}[13] Copy standalone files...${NC}"

# Next.js standalone braucht static files
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

chown -R www-data:www-data /var/www/levcon

# ── 14. SYSTEMD SERVICE ────────────────────────────────────────
echo -e "\n${YELLOW}[14] Systemd service...${NC}"

cp deploy/systemd/levcon.service /etc/systemd/system/levcon.service
systemctl daemon-reload
systemctl enable levcon

# ── 15. SSL CERTIFICATES (Let's Encrypt) — VOR nginx config! ───
echo -e "\n${YELLOW}[15] SSL certificates (vor nginx config)...${NC}"

echo -e "${YELLOW}Hinweis: Stelle sicher, dass levcon.ai und engine.levcon.at auf 87.106.25.91 zeigen!${NC}"
echo -e "${YELLOW}Drücke ENTER zum Fortfahren...${NC}"
read

# nginx stoppen (falls noch Reste laufen) — certbot --standalone braucht Port 80
systemctl stop nginx 2>/dev/null || true

# levcon.ai (ohne www — falls www gewünscht, später mit certbot expand hinzufügen)
if [ ! -f "/etc/letsencrypt/live/levcon.ai/fullchain.pem" ]; then
    echo "Erstelle Zertifikat für levcon.ai (via standalone)..."
    certbot certonly --standalone \
        -d levcon.ai \
        --email admin@levcon.at --agree-tos --no-eff-email --non-interactive
fi

# engine.levcon.at
if [ ! -f "/etc/letsencrypt/live/engine.levcon.at/fullchain.pem" ]; then
    echo "Erstelle Zertifikat für engine.levcon.at (via standalone)..."
    certbot certonly --standalone \
        -d engine.levcon.at \
        --email admin@levcon.at --agree-tos --no-eff-email --non-interactive
fi

# ── 16. NGINX CONFIGURATION ────────────────────────────────────
echo -e "\n${YELLOW}[16] Nginx configuration...${NC}"

mkdir -p /var/www/letsencrypt

# levcon.ai
cp deploy/nginx/levcon.ai.conf /etc/nginx/sites-available/levcon.ai
ln -sf /etc/nginx/sites-available/levcon.ai /etc/nginx/sites-enabled/levcon.ai

# engine.levcon.at — falls bereits "n8n" config existiert, diese deaktivieren
if [ -f /etc/nginx/sites-enabled/n8n ] || [ -f /etc/nginx/sites-available/n8n ]; then
    echo "  Bestehende n8n config deaktiviert (durch engine.levcon.at ersetzt)"
    rm -f /etc/nginx/sites-enabled/n8n
fi
cp deploy/nginx/engine.levcon.at.conf /etc/nginx/sites-available/engine.levcon.at
ln -sf /etc/nginx/sites-available/engine.levcon.at /etc/nginx/sites-enabled/engine.levcon.at

# Default site entfernen (sonst Konflikt)
rm -f /etc/nginx/sites-enabled/default

# Test config (warnings sind OK, nur errors blocken)
if nginx -t 2>&1; then
    echo "  ✓ Nginx config OK"
else
    echo -e "${RED}  ✗ Nginx config test fehlgeschlagen${NC}"
    echo -e "${YELLOW}  Prüfe Fehler oben. Andere Sites (matrix, fincal etc.) können Warnungen verursachen.${NC}"
    exit 1
fi

# ── 17. NGINX BASIC AUTH (für n8n UI) ──────────────────────────
echo -e "\n${YELLOW}[17] Nginx Basic Auth für n8n UI...${NC}"

if [ ! -f "/etc/nginx/.htpasswd.engine" ]; then
    echo -e "${YELLOW}Erstelle Basic Auth für n8n UI (engine.levcon.at)${NC}"
    echo -e "${YELLOW}Username: admin${NC}"
    echo -e "${YELLOW}Bitte Passwort eingeben:${NC}"
    htpasswd -c /etc/nginx/.htpasswd.engine admin
fi

# ── 18. AUTO-RENEWAL (Let's Encrypt) ───────────────────────────
echo -e "\n${YELLOW}[18] Auto-renewal...${NC}"

# Certbot systemd timer
systemctl enable certbot.timer
systemctl start certbot.timer

# Reload nginx nach Renewal
cat > /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh << 'EOF'
#!/bin/bash
systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh

# ── 19. START SERVICES ─────────────────────────────────────────
echo -e "\n${YELLOW}[19] Start services...${NC}"

systemctl restart nginx
systemctl restart levcon

# ── 20. DB BACKUP CRON ─────────────────────────────────────────
echo -e "\n${YELLOW}[20] DB backup cron...${NC}"

mkdir -p /var/backups/levcon

cat > /etc/cron.d/levcon-backup << 'EOF'
# Levcon DB Backup — täglich 03:00
0 3 * * * root sqlite3 /var/www/levcon/db/levcon.db ".dump" | gzip > /var/backups/levcon/levcon-$(date +\%Y\%m\%d).db.gz && find /var/backups/levcon -name "levcon-*.db.gz" -mtime +30 -delete
EOF
chmod 644 /etc/cron.d/levcon-backup

# ── 21. FINAL STATUS ───────────────────────────────────────────
echo -e "\n${GREEN}═════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  DEPLOYMENT ERFOLGREICH!${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}Status:${NC}"
systemctl status levcon --no-pager | head -5
echo ""
systemctl status nginx --no-pager | head -5

echo -e "\n${YELLOW}URLs:${NC}"
echo "  https://levcon.ai"
echo "  https://engine.levcon.at (n8n)"

echo -e "\n${YELLOW}WICHTIG: Noch zu erledigen:${NC}"
echo "  1. SMTP_PASS in /var/www/levcon/.env eintragen: nano /var/www/levcon/.env"
echo "  2. ZAI_API_KEY in /var/www/levcon/.env eintragen"
echo "  3. Nach .env-Änderung: systemctl restart levcon"
echo "  4. n8n-Workflows importieren (siehe deploy/n8n/README.md)"
echo "  5. n8n Credentials einrichten (SMTP, z-ai, Levcon Internal API)"

echo -e "\n${YELLOW}Logs:${NC}"
echo "  Next.js: journalctl -u levcon -f"
echo "  Nginx:   tail -f /var/log/nginx/levcon.ai.error.log"
echo "  n8n:     docker logs n8n -f"

echo -e "\n${GREEN}Fertig! 🎉${NC}"

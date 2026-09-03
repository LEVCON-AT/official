#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  LEVCON.AI STAGING — VPS SETUP SCRIPT (ONE-TIME)
#  Erstellt staging.levcon.ai vollständig auf dem VPS
# ═══════════════════════════════════════════════════════════════
#
#  Ausführung:
#    ssh root@87.106.25.91
#    cd /var/www/levcon && git pull origin main
#    bash deploy/staging/vps-setup-staging.sh
#
#  WICHTIG: Dieses Skript ist RESUME-FÄHIG.
#  Falls es abbricht, kann es erneut aufgerufen werden — es überspringt
#  automatisch alle Schritte die schon erledigt sind.
#
#  Voraussetzungen (siehe Preflight-Skript):
#  ✅ DNS: staging.levcon.ai → 87.106.25.91
#  ✅ Production läuft unter /var/www/levcon
#  ✅ Port 3006 frei
#  ✅ Bun, Node, Git, nginx, certbot, sqlite3 installiert
#  ✅ www-data User existiert
#  ✅ UFW: Port 80+443 offen

set -e  # Abbruch bei Fehler

# Non-interactive mode
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
    exit 1
fi

# Port 3006 muss frei sein
if ss -tln | grep -q ':3006 '; then
    echo -e "${RED}Port 3006 ist belegt!${NC}"
    ss -tln | grep ':3006'
    exit 1
fi

# DNS muss korrekt sein
PUBLIC_IP=$(curl -sS --max-time 5 https://api.ipify.org 2>/dev/null || echo "")
STAGING_IP=$(dig +short staging.levcon.ai 2>/dev/null | head -1)
if [ -z "$STAGING_IP" ] || [ "$STAGING_IP" != "$PUBLIC_IP" ]; then
    echo -e "${RED}DNS-Fehler: staging.levcon.ai → $STAGING_IP (erwartet: $PUBLIC_IP)${NC}"
    exit 1
fi
echo -e "${GREEN}  ✅ DNS korrekt: staging.levcon.ai → $PUBLIC_IP${NC}"
echo -e "${GREEN}  ✅ Port 3006 frei${NC}"

# Resume-Modus erkennen
RESUME_MODE=0
if [ -d "/var/www/levcon-staging" ] && \
   [ -f "/var/www/levcon-staging/.next/standalone/server.js" ] && \
   [ -f "/var/www/levcon-staging/.env" ]; then
    echo -e "${YELLOW}  ⏭ /var/www/levcon-staging existiert mit Build → RESUME-Modus${NC}"
    echo -e "${YELLOW}    Überspringe Schritte 2-7 (Clone, Build), mache mit SSL + nginx weiter${NC}"
    RESUME_MODE=1
elif [ -d "/var/www/levcon-staging" ]; then
    echo -e "${RED}  /var/www/levcon-staging existiert aber unvollständig!${NC}"
    echo -e "${YELLOW}  Bitte cleanen: sudo rm -rf /var/www/levcon-staging${NC}"
    exit 1
else
    echo -e "${GREEN}  ✅ /var/www/levcon-staging existiert nicht — frischer Setup${NC}"
fi

# ── 1. PRODUCTION GIT REMOTE URL AUF SSH UMSTELLEN (immer!) ───
echo -e "\n${BLUE}[1] Production Git Remote URL auf SSH umstellen...${NC}"

cd /var/www/levcon
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null)
echo "  Aktuelle Remote URL: $CURRENT_REMOTE"

if echo "$CURRENT_REMOTE" | grep -q "^https://github.com"; then
    echo -e "${YELLOW}  ⚠ HTTPS Remote gefunden — FIX nötig${NC}"
    git remote set-url origin git@github.com:LEVCON-AT/official.git
    echo -e "${GREEN}  ✅ Remote URL auf SSH umgestellt${NC}"
    if ! git fetch origin main 2>&1; then
        echo -e "${RED}  ❌ git fetch fehlgeschlagen! SSH-Keys prüfen.${NC}"
        echo -e "${YELLOW}  Siehe: https://github.com/LEVCON-AT/official/settings/keys${NC}"
        exit 1
    fi
    echo -e "${GREEN}  ✅ git fetch erfolgreich (SSH-Auth klappt)${NC}"
else
    echo -e "${GREEN}  ✅ Remote ist bereits SSH${NC}"
fi

# ── Schritte 2-7: Nur bei frischem Setup ausführen ────────────
if [ "$RESUME_MODE" = "0" ]; then

    # ── 2. STAGING REPO KLONEN ────────────────────────────────
    echo -e "\n${BLUE}[2] Clone repo to /var/www/levcon-staging (staging branch)...${NC}"

    cd /var/www
    git clone --branch staging git@github.com:LEVCON-AT/official.git levcon-staging
    cd /var/www/levcon-staging
    git config --global --add safe.directory /var/www/levcon-staging
    git config --add safe.directory /var/www/levcon-staging
    echo -e "${GREEN}  ✅ Repo geklont (branch: staging)${NC}"
    echo "  Commit: $(git log --oneline -1)"

    # ── 3. ENVIRONMENT FILE ERSTELLEN ──────────────────────────
    echo -e "\n${BLUE}[3] Environment file erstellen...${NC}"

    cp deploy/.env.staging .env
    INTERNAL_KEY=$(openssl rand -hex 32)
    sed -i "s/CHANGE_ME_TO_32_CHARS_RANDOM_STAGING/$INTERNAL_KEY/g" .env

    # Korrigiere DATABASE_URL
    VPS_DB_URL="file:/var/www/levcon-staging/db/levcon-staging.db"
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$VPS_DB_URL\"|" .env

    # NEXT_PUBLIC_SITE_URL
    sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=\"https://staging.levcon.ai\"|" .env

    # NEXT_PUBLIC_ENVIRONMENT
    if grep -q "^NEXT_PUBLIC_ENVIRONMENT=" .env; then
        sed -i "s|^NEXT_PUBLIC_ENVIRONMENT=.*|NEXT_PUBLIC_ENVIRONMENT=\"staging\"|" .env
    else
        echo 'NEXT_PUBLIC_ENVIRONMENT="staging"' >> .env
    fi

    # SMTP_HOST (ionos.de, nicht ionos.at)
    sed -i "s|^SMTP_HOST=.*|SMTP_HOST=\"smtp.ionos.de\"|" .env
    sed -i "s|^SMTP_USER=.*|SMTP_USER=\"admin@levcon.at\"|" .env

    # CONTACT_EMAIL
    sed -i "s|^CONTACT_EMAIL=.*|CONTACT_EMAIL=\"hello@levcon.ai\"|" .env

    # PORT = 3006
    if grep -q "^PORT=" .env; then
        sed -i "s|^PORT=.*|PORT=\"3006\"|" .env
    else
        echo 'PORT="3006"' >> .env
    fi

    chmod 600 .env
    echo -e "${GREEN}  ✅ .env erstellt${NC}"
    echo -e "${BLUE}  Staging API-Key (notieren!):${NC}"
    echo -e "${GREEN}  $INTERNAL_KEY${NC}"

    # ── 4. DATABASE DIRECTORY ─────────────────────────────────
    echo -e "\n${BLUE}[4] Database directory erstellen...${NC}"
    mkdir -p db
    chown -R www-data:www-data db
    chmod 755 db
    echo -e "${GREEN}  ✅ db/ erstellt${NC}"

    # ── 5. DEPENDENCIES INSTALLIEREN ──────────────────────────
    echo -e "\n${BLUE}[5] Dependencies installieren...${NC}"
    cd /var/www/levcon-staging
    bun install
    echo -e "${GREEN}  ✅ Dependencies installiert${NC}"

    # ── 6. PRISMA DB PUSH ─────────────────────────────────────
    echo -e "\n${BLUE}[6] Prisma DB push (erstellt Staging-DB)...${NC}"
    chmod +x node_modules/@prisma/engines/* 2>/dev/null || true
    chmod +x node_modules/.bin/* 2>/dev/null || true

    bun run db:push --accept-data-loss 2>&1 || bun run db:push 2>&1

    if [ -f "db/levcon-staging.db" ]; then
        echo -e "${GREEN}  ✅ Staging-DB erstellt: $(ls -la db/levcon-staging.db | awk '{print $5}') bytes${NC}"
        chown www-data:www-data db/levcon-staging.db
        chmod 664 db/levcon-staging.db
    else
        echo -e "${RED}  ❌ Staging-DB wurde nicht erstellt!${NC}"
        exit 1
    fi

    # ── 7. NEXT.JS BUILD ──────────────────────────────────────
    echo -e "\n${BLUE}[7] Next.js build (NEXT_PUBLIC_ENVIRONMENT=staging)...${NC}"
    export NEXT_PUBLIC_ENVIRONMENT="staging"
    export NEXT_PUBLIC_SITE_URL="https://staging.levcon.ai"
    bun run build
    echo -e "${GREEN}  ✅ Build erfolgreich${NC}"

    # ── 8. STANDALONE FILES ────────────────────────────────────
    echo -e "\n${BLUE}[8] Copy standalone files...${NC}"
    cp -r public .next/standalone/
    cp -r .next/static .next/standalone/.next/
    mkdir -p .next/standalone/.next/cache
    mkdir -p .next/cache
    chown -R www-data:www-data /var/www/levcon-staging
    echo -e "${GREEN}  ✅ Static files kopiert${NC}"

    # ── 9. SYSTEMD SERVICE ────────────────────────────────────
    echo -e "\n${BLUE}[9] Systemd service (levcon-staging, Port 3006)...${NC}"
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
    echo -e "${GREEN}  ✅ systemd Service installiert (Port 3006)${NC}"

else
    # RESUME-Modus: Lade INTERNAL_KEY aus bestehender .env
    cd /var/www/levcon-staging
    INTERNAL_KEY=$(grep "^LEVCON_INTERNAL_API_KEY=" .env | cut -d'=' -f2- | tr -d '"')
    echo -e "${YELLOW}  Staging API-Key aus .env geladen: ${INTERNAL_KEY:0:16}...${NC}"
fi

# ── 10. SSL-ZERTIFIKAT BEANTRAGEN (VOR nginx config!) ─────────
echo -e "\n${BLUE}[10] SSL-Zertifikat für staging.levcon.ai beantragen...${NC}"

if [ -f "/etc/letsencrypt/live/staging.levcon.ai/fullchain.pem" ]; then
    echo -e "${YELLOW}  ℹ Zertifikat existiert bereits — überspringe Beantragung${NC}"
else
    echo -e "${YELLOW}  ⚠ Stoppe nginx für certbot --standalone (andere Sites ~30 Sek offline)...${NC}"

    # Falls alte staging.levcon.ai nginx Config existiert → erst deaktivieren
    # (sonst nginx test schlägt fehl wenn Zertifikate fehlen)
    if [ -L /etc/nginx/sites-enabled/staging.levcon.ai ]; then
        echo "  Entferne alte staging nginx-Site (wird nach SSL neu installiert)"
        rm -f /etc/nginx/sites-enabled/staging.levcon.ai
    fi

    systemctl stop nginx
    sleep 2

    if certbot certonly --standalone \
        -d staging.levcon.ai \
        --email admin@levcon.at --agree-tos --no-eff-email --non-interactive; then
        echo -e "${GREEN}  ✅ SSL-Zertifikat beantragt${NC}"
    else
        echo -e "${RED}  ❌ Certbot fehlgeschlagen!${NC}"
        systemctl start nginx
        exit 1
    fi

    systemctl start nginx
    sleep 2
    echo -e "${GREEN}  ✅ Nginx wieder gestartet${NC}"
fi

# ── 11. NGINX SITE INSTALLIEREN ───────────────────────────────
echo -e "\n${BLUE}[11] Nginx config für staging.levcon.ai installieren...${NC}"

cp /var/www/levcon-staging/deploy/nginx/staging.levcon.ai.conf /etc/nginx/sites-available/staging.levcon.ai
sed -i 's/127.0.0.1:300[0-9]/127.0.0.1:3006/g' /etc/nginx/sites-available/staging.levcon.ai
ln -sf /etc/nginx/sites-available/staging.levcon.ai /etc/nginx/sites-enabled/staging.levcon.ai

if nginx -t 2>&1; then
    echo -e "${GREEN}  ✅ Nginx config OK${NC}"
    systemctl reload nginx
    echo -e "${GREEN}  ✅ Nginx reloaded${NC}"
else
    echo -e "${RED}  ❌ Nginx config test fehlgeschlagen!${NC}"
    ls -la /etc/letsencrypt/live/staging.levcon.ai/
    exit 1
fi

# ── 12. SERVICES STARTEN ───────────────────────────────────────
echo -e "\n${BLUE}[12] Services starten...${NC}"

systemctl restart levcon-staging
sleep 3

if systemctl is-active --quiet levcon-staging; then
    echo -e "${GREEN}  ✅ levcon-staging service aktiv${NC}"
else
    echo -e "${RED}  ❌ levcon-staging service nicht aktiv!${NC}"
    journalctl -u levcon-staging --no-pager -n 30
    exit 1
fi

if ss -tln | grep -q ':3006'; then
    echo -e "${GREEN}  ✅ Port 3006 lauscht${NC}"
else
    echo -e "${RED}  ❌ Port 3006 nicht erreichbar${NC}"
    journalctl -u levcon-staging --no-pager -n 30
    exit 1
fi

# ── 13. BACKUP-CRON ────────────────────────────────────────────
echo -e "\n${BLUE}[13] Staging DB backup cron...${NC}"
mkdir -p /var/backups/levcon-staging

cat > /etc/cron.d/levcon-staging-backup << 'EOF'
# Levcon Staging DB Backup — täglich 03:30 (30 Min nach Production)
30 3 * * * root sqlite3 /var/www/levcon-staging/db/levcon-staging.db ".dump" | gzip > /var/backups/levcon-staging/levcon-staging-$(date +\%Y\%m\%d).db.gz && find /var/backups/levcon-staging -name "levcon-staging-*.db.gz" -mtime +7 -delete
EOF
chmod 644 /etc/cron.d/levcon-staging-backup
echo -e "${GREEN}  ✅ Backup-Cron installiert${NC}"

# ── 14. VERIFIKATION ───────────────────────────────────────────
echo -e "\n${BLUE}[14] Verifikation...${NC}"

echo ""
echo -e "${BLUE}Test 1: Lokal (Port 3006)${NC}"
curl -sSI --max-time 5 http://127.0.0.1:3006/ | head -3

echo ""
echo -e "${BLUE}Test 2: Extern (https://staging.levcon.ai)${NC}"
curl -sSI --max-time 10 https://staging.levcon.ai/ | head -5

echo ""
echo -e "${BLUE}Test 3: X-Robots-Tag Header${NC}"
curl -sSI --max-time 10 https://staging.levcon.ai/ | grep -i "x-robots-tag" || echo "  ⚠ X-Robots-Tag nicht gefunden"

echo ""
echo -e "${BLUE}Test 4: robots.txt${NC}"
curl -sS --max-time 10 https://staging.levcon.ai/robots.txt | head -5

echo ""
echo -e "${BLUE}Test 5: StagingBanner in HTML${NC}"
BANNER_COUNT=$(curl -sS --max-time 10 https://staging.levcon.ai/ | grep -c "staging-banner" 2>/dev/null || echo 0)
echo "  staging-banner in HTML: $BANNER_COUNT (erwartet: ≥1)"

echo ""
echo -e "${BLUE}Test 6: /api/ai-news/quality-report (sollte 401)${NC}"
curl -sSI --max-time 10 https://staging.levcon.ai/api/ai-news/quality-report | head -3

echo ""
echo -e "${BLUE}Test 7: Health Check${NC}"
if curl -sf https://staging.levcon.ai/ -o /dev/null; then
    echo -e "${GREEN}  ✅ Health check passed${NC}"
else
    echo -e "${RED}  ❌ Health check failed${NC}"
    journalctl -u levcon-staging --no-pager -n 20
    exit 1
fi

# ── FINAL STATUS ───────────────────────────────────────────────
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
echo -e "${BLUE}Staging API-Key (sicher speichern):${NC}"
echo "  $INTERNAL_KEY"

echo ""
echo -e "${BLUE}Nächste Schritte:${NC}"
echo "  1. Browser: https://staging.levcon.ai → roter STAGING-Banner sichtbar"
echo "  2. Admin-Panel testen (URL oben)"
echo "  3. GitHub Actions für Staging testen (push auf staging-branch)"

echo ""
echo -e "${BLUE}Logs:${NC}"
echo "  Staging: journalctl -u levcon-staging -f"
echo "  Nginx:   tail -f /var/log/nginx/staging.levcon.ai.error.log"

echo ""
echo -e "${GREEN}Fertig! 🎉${NC}"

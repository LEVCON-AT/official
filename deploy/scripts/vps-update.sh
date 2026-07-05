#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  LEVCON.AI — VPS UPDATE SCRIPT
#  Wird bei jedem Push auf main via GitHub Actions ausgeführt
# ═══════════════════════════════════════════════════════════════
#
#  Dieses Skript:
#  - Macht git pull (latest main)
#  - Installiert Dependencies
#  - Updated DB Schema (falls geändert)
#  - Baut Next.js neu (Standalone)
#  - Kopiert static files
#  - Restartet systemd service
#  - Reloaded nginx (falls config geändert)
#
#  WICHTIG: Falls der Build fehlschlägt, läuft der Service
#  auf dem alten Build weiter (Rollback durch Inaktivität).

set -e

# Non-interactive mode (wichtig für CI/CD — keine Prompts!)
export DEBIAN_FRONTEND=noninteractive
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  LEVCON.AI — VPS UPDATE${NC}"
echo -e "${GREEN}  $(date)${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

# Project directory
PROJECT_DIR="/var/www/levcon"
cd "$PROJECT_DIR" || {
    echo -e "${RED}Project directory not found: $PROJECT_DIR${NC}"
    exit 1
}

# Fix "dubious ownership" warning (root vs www-data)
git config --global --add safe.directory "$PROJECT_DIR"
git config --add safe.directory "$PROJECT_DIR"

# ── 1. SAVE CURRENT STATE (for rollback) ───────────────────────
echo -e "\n${YELLOW}[1] Save current state for rollback...${NC}"

# Backup current .next (for rollback if build fails)
if [ -d ".next/standalone" ]; then
    cp -r .next/standalone .next/standalone.backup
    cp -r .next/static .next/static.backup
    echo "  ✓ Backup erstellt"
fi

# ── 2. GIT PULL ────────────────────────────────────────────────
echo -e "\n${YELLOW}[2] Git pull...${NC}"

# Reset any local changes (force clean state)
git fetch origin main
git reset --hard origin/main
git clean -fd

echo "  ✓ Code aktualisiert: $(git log --oneline -1)"

# ── 3. INSTALL DEPENDENCIES ────────────────────────────────────
echo -e "\n${YELLOW}[3] Install dependencies...${NC}"

bun install --frozen-lockfile --no-progress 2>&1 || bun install --frozen-lockfile 2>&1
echo "  ✓ Dependencies installiert"

# ── 4. PRISMA DB PUSH (falls Schema geändert) ──────────────────
echo -e "\n${YELLOW}[4] Prisma DB push...${NC}"

bun run db:push
echo "  ✓ DB Schema synchronisiert"

# ── 5. NEXT.JS BUILD ───────────────────────────────────────────
echo -e "\n${YELLOW}[5] Next.js build...${NC}"

# Build mit Timeout (verhindert Endlosschleife)
if timeout 300 bun run build; then
    echo "  ✓ Build erfolgreich"
else
    echo -e "${RED}  ✗ Build fehlgeschlagen — Restore backup${NC}"
    
    # Restore backup
    if [ -d ".next/standalone.backup" ]; then
        rm -rf .next/standalone
        mv .next/standalone.backup .next/standalone
        rm -rf .next/static
        mv .next/static.backup .next/static
        echo -e "${YELLOW}  ⚠ Backup wiederhergestellt — Service läuft auf altem Build${NC}"
    fi
    
    exit 1
fi

# ── 6. COPY STANDALONE FILES ───────────────────────────────────
echo -e "\n${YELLOW}[6] Copy standalone files...${NC}"

# Next.js standalone braucht public + static
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

echo "  ✓ Static files kopiert"

# ── 7. PERMISSIONS ─────────────────────────────────────────────
echo -e "\n${YELLOW}[7] Set permissions...${NC}"

# Ownership ( rekursiv, aber schnell mit chown -R)
chown -R www-data:www-data /var/www/levcon

# WICHTIG: Nur kritische Files chmod'en, nicht node_modules (das dauert ewig)
chmod 755 /var/www/levcon
chmod 755 /var/www/levcon/db 2>/dev/null || true
chmod 644 /var/www/levcon/.env
chmod 755 /var/www/levcon/.next/standalone/server.js 2>/dev/null || true

# DB schreibbar machen
chmod 664 /var/www/levcon/db/levcon.db 2>/dev/null || true

# Prisma Engines brauchen Execute-Rechte (sonst EACCES bei db:push)
chmod +x /var/www/levcon/node_modules/@prisma/engines/* 2>/dev/null || true
# Auch node binary selbst
chmod +x /var/www/levcon/node_modules/.bin/* 2>/dev/null || true

echo "  ✓ Permissions gesetzt"

# ── 8. NGINX CONFIG (falls geändert) ───────────────────────────
echo -e "\n${YELLOW}[8] Nginx config check...${NC}"

# Copy nginx configs if they exist and changed
if [ -f "deploy/nginx/levcon.ai.conf" ]; then
    cp deploy/nginx/levcon.ai.conf /etc/nginx/sites-available/levcon.ai
    cp deploy/nginx/engine.levcon.at.conf /etc/nginx/sites-available/engine.levcon.at
    ln -sf /etc/nginx/sites-available/levcon.ai /etc/nginx/sites-enabled/levcon.ai
    ln -sf /etc/nginx/sites-available/engine.levcon.at /etc/nginx/sites-enabled/engine.levcon.at
    rm -f /etc/nginx/sites-enabled/default
fi

# Test nginx config
if nginx -t 2>&1; then
    systemctl reload nginx
    echo "  ✓ Nginx reloaded"
else
    echo -e "${RED}  ✗ Nginx config test failed — skip reload${NC}"
fi

# ── 9. SYSTEMD SERVICE RESTART ─────────────────────────────────
echo -e "\n${YELLOW}[9] Restart levcon service...${NC}"

systemctl restart levcon
sleep 2

# Check if service is running
if systemctl is-active --quiet levcon; then
    echo "  ✓ Service läuft"
else
    echo -e "${RED}  ✗ Service nicht gestartet!${NC}"
    journalctl -u levcon --no-pager -n 30
    exit 1
fi

# ── 10. CLEANUP BACKUPS ────────────────────────────────────────
echo -e "\n${YELLOW}[10] Cleanup backups...${NC}"

rm -rf .next/standalone.backup .next/static.backup
echo "  ✓ Backups entfernt"

# ── 11. FINAL STATUS ───────────────────────────────────────────
echo -e "\n${GREEN}═════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  UPDATE ERFOLGREICH!${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}Commit:${NC} $(git log --oneline -1)"
echo -e "${YELLOW}Service:${NC} $(systemctl is-active levcon)"
echo -e "${YELLOW}URL:${NC} https://levcon.ai"

# Optional: Send success notification to owner (deaktiviert by default)
# echo "Deploy successful: $(git log --oneline -1)" | mail -s "Levcon Deploy OK" admin@levcon.at

exit 0

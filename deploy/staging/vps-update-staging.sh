#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  LEVCON.AI STAGING — VPS UPDATE SCRIPT
#  Wird bei jedem Push auf `staging` via GitHub Actions ausgeführt
# ═══════════════════════════════════════════════════════════════
#
#  Dieses Skript:
#  - Macht git pull (latest staging branch)
#  - Installiert Dependencies
#  - Updated DB Schema (falls geändert)
#  - Baut Next.js neu (Standalone) — mit NEXT_PUBLIC_ENVIRONMENT=staging
#  - Kopiert static files
#  - Restartet systemd service levcon-staging
#  - Reloaded nginx (falls config geändert)
#
#  WICHTIG: Falls der Build fehlschlägt, läuft der Service
#  auf dem alten Build weiter (Rollback durch Inaktivität).
#
#  Unterschiede zu vps-update.sh (Production):
#  - Project dir: /var/www/levcon-staging (nicht /var/www/levcon)
#  - git branch: staging (nicht main)
#  - NEXT_PUBLIC_ENVIRONMENT=staging während build (für Client-Bundle)
#  - Service: levcon-staging (nicht levcon)
#  - DB: levcon-staging.db (nicht levcon.db)

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
echo -e "${GREEN}  LEVCON.AI — STAGING UPDATE${NC}"
echo -e "${GREEN}  $(date)${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

# Project directory (STAGING — nicht Production!)
PROJECT_DIR="/var/www/levcon-staging"
cd "$PROJECT_DIR" || {
    echo -e "${RED}Project directory not found: $PROJECT_DIR${NC}"
    echo -e "${YELLOW}Führe zuerst deploy/staging/vps-setup-staging.sh aus!${NC}"
    exit 1
}

# Fix "dubious ownership" warning
git config --global --add safe.directory "$PROJECT_DIR"
git config --add safe.directory "$PROJECT_DIR"

# ── 1. SAVE CURRENT STATE (for rollback) ───────────────────────
echo -e "\n${YELLOW}[1] Save current state for rollback...${NC}"

if [ -d ".next/standalone" ]; then
    cp -r .next/standalone .next/standalone.backup
    cp -r .next/static .next/static.backup
    echo "  ✓ Backup erstellt"
fi

# ── 2. GIT PULL (STAGING BRANCH) ───────────────────────────────
echo -e "\n${YELLOW}[2] Git pull (staging branch)...${NC}"

# Reset any local changes (force clean state)
# WICHTIG: -e .env schützt die .env vor dem Löschen (sonst Secrets weg)
git fetch origin staging
git reset --hard origin/staging
git clean -fd -e .env -e .env.local -e .env.staging

echo "  ✓ Code aktualisiert: $(git log --oneline -1)"

# ── 2.5. ENV-FILE KORRIGIEREN (nach git pull, vor db:push) ─────
# WICHTIG: .env hat evtl. noch DATABASE_URL=file:/home/z/my-project/...
# (Dev-Umgebung). Das muss auf VPS-Staging-Pfad korrigiert werden.
if [ -f ".env" ]; then
    VPS_DB_URL="file:/var/www/levcon-staging/db/levcon-staging.db"
    if grep -q "^DATABASE_URL=" .env; then
        CURRENT_DB_URL=$(grep "^DATABASE_URL=" .env | head -1 | cut -d'=' -f2- | tr -d '"')
        if [ "$CURRENT_DB_URL" != "$VPS_DB_URL" ]; then
            echo "  Korrigiere DATABASE_URL: $CURRENT_DB_URL → $VPS_DB_URL"
            sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$VPS_DB_URL\"|" .env
        fi
    else
        echo "DATABASE_URL=\"$VPS_DB_URL\"" >> .env
        echo "  Füge DATABASE_URL hinzu: $VPS_DB_URL"
    fi
    # PORT sicherstellen (Staging = 3006, 3003-3005 sind durch andere Services belegt)
    if grep -q "^PORT=" .env; then
        sed -i "s|^PORT=.*|PORT=\"3006\"|" .env
    else
        echo "PORT=\"3006\"" >> .env
    fi
    # NEXT_PUBLIC_SITE_URL sicherstellen
    if grep -q "^NEXT_PUBLIC_SITE_URL=" .env; then
        sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=\"https://staging.levcon.ai\"|" .env
    else
        echo "NEXT_PUBLIC_SITE_URL=\"https://staging.levcon.ai\"" >> .env
    fi
    # NEXT_PUBLIC_ENVIRONMENT sicherstellen (MUSS 'staging' sein!)
    if grep -q "^NEXT_PUBLIC_ENVIRONMENT=" .env; then
        sed -i "s|^NEXT_PUBLIC_ENVIRONMENT=.*|NEXT_PUBLIC_ENVIRONMENT=\"staging\"|" .env
    else
        echo "NEXT_PUBLIC_ENVIRONMENT=\"staging\"" >> .env
    fi
else
    echo -e "${RED}  ✗ .env fehlt! Erstelle aus Template...${NC}"
    cp deploy/.env.staging .env 2>/dev/null || true
    if [ ! -f ".env" ]; then
        echo "DATABASE_URL=\"file:/var/www/levcon-staging/db/levcon-staging.db\"" > .env
        echo "PORT=\"3006\"" >> .env
        echo "NEXT_PUBLIC_SITE_URL=\"https://staging.levcon.ai\"" >> .env
        echo "NEXT_PUBLIC_ENVIRONMENT=\"staging\"" >> .env
        echo "LEVCON_INTERNAL_API_KEY=\"$(openssl rand -hex 32)\"" >> .env
        echo "  ⚠ Minimal-Env erstellt — bitte SMTP_PASS etc. eintragen!"
    fi
fi

# ── 3. INSTALL DEPENDENCIES ────────────────────────────────────
echo -e "\n${YELLOW}[3] Install dependencies...${NC}"

bun install --frozen-lockfile --no-progress 2>&1 || bun install --frozen-lockfile 2>&1
echo "  ✓ Dependencies installiert"

# ── 4. PRISMA DB PUSH (falls Schema geändert) ──────────────────
echo -e "\n${YELLOW}[4] Prisma DB push...${NC}"

# Prisma-Engines brauchen Execute-Rechte VOR db:push
chmod +x node_modules/@prisma/engines/* 2>/dev/null || true
chmod +x node_modules/.bin/* 2>/dev/null || true

# db:push ausführen (mit --accept-data-loss für Schema-Änderungen)
bun run db:push --accept-data-loss 2>&1 || bun run db:push 2>&1

# DB-Ownership korrigieren (Staging!)
chown -R www-data:www-data db 2>/dev/null || true
chmod 755 db 2>/dev/null || true
if [ -f "db/levcon-staging.db" ]; then
    chown www-data:www-data db/levcon-staging.db
    chmod 664 db/levcon-staging.db
    echo "  ✓ DB ownership korrigiert (www-data)"
    echo "  ✓ DB Pfad: $(pwd)/db/levcon-staging.db"
else
    echo -e "${RED}  ✗ DB-Datei nicht gefunden nach db:push!${NC}"
    echo "  Erwartet: $(pwd)/db/levcon-staging.db"
fi

echo "  ✓ DB Schema synchronisiert"

# ── 5. NEXT.JS BUILD (mit Staging-Env) ─────────────────────────
echo -e "\n${YELLOW}[5] Next.js build (NEXT_PUBLIC_ENVIRONMENT=staging)...${NC}"

# WICHTIG: NEXT_PUBLIC_* Variablen müssen WÄHREND des Builds gesetzt sein,
# weil Next.js sie in den Client-Bundle bakt. Spätere Änderungen haben keinen Effekt.
export NEXT_PUBLIC_ENVIRONMENT="staging"
export NEXT_PUBLIC_SITE_URL="https://staging.levcon.ai"

# Build mit Timeout
if timeout 300 bun run build; then
    echo "  ✓ Build erfolgreich (Staging-Flags aktiv)"
else
    echo -e "${RED}  ✗ Build fehlgeschlagen — Restore backup${NC}"
    
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

cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

echo "  ✓ Static files kopiert"

# ── 7. PERMISSIONS ─────────────────────────────────────────────
echo -e "\n${YELLOW}[7] Set permissions...${NC}"

chown -R www-data:www-data /var/www/levcon-staging

chmod 755 /var/www/levcon-staging
chmod 755 /var/www/levcon-staging/db 2>/dev/null || true
chmod 600 /var/www/levcon-staging/.env
chmod 755 /var/www/levcon-staging/.next/standalone/server.js 2>/dev/null || true
chmod 664 /var/www/levcon-staging/db/levcon-staging.db 2>/dev/null || true

# Prisma Engines Execute-Rechte
chmod +x /var/www/levcon-staging/node_modules/@prisma/engines/* 2>/dev/null || true
chmod +x /var/www/levcon-staging/node_modules/.bin/* 2>/dev/null || true

echo "  ✓ Permissions gesetzt"

# ── 8. NGINX CONFIG (falls geändert) ───────────────────────────
echo -e "\n${YELLOW}[8] Nginx config check...${NC}"

# Staging nginx config kopieren (Production-config nicht antasten!)
if [ -f "deploy/nginx/staging.levcon.ai.conf" ]; then
    cp deploy/nginx/staging.levcon.ai.conf /etc/nginx/sites-available/staging.levcon.ai
    ln -sf /etc/nginx/sites-available/staging.levcon.ai /etc/nginx/sites-enabled/staging.levcon.ai
fi

if nginx -t 2>&1; then
    systemctl reload nginx
    echo "  ✓ Nginx reloaded"
else
    echo -e "${RED}  ✗ Nginx config test failed — skip reload${NC}"
fi

# ── 9. SYSTEMD SERVICE RESTART (STAGING) ───────────────────────
echo -e "\n${YELLOW}[9] Restart levcon-staging service...${NC}"

systemctl restart levcon-staging
sleep 2

if systemctl is-active --quiet levcon-staging; then
    echo "  ✓ Staging-Service läuft"
else
    echo -e "${RED}  ✗ Staging-Service nicht gestartet!${NC}"
    journalctl -u levcon-staging --no-pager -n 30
    exit 1
fi

# ── 10. CLEANUP BACKUPS ────────────────────────────────────────
echo -e "\n${YELLOW}[10] Cleanup backups...${NC}"

rm -rf .next/standalone.backup .next/static.backup
echo "  ✓ Backups entfernt"

# ── 11. FINAL STATUS ───────────────────────────────────────────
echo -e "\n${GREEN}═════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  STAGING UPDATE ERFOLGREICH!${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}Commit:${NC} $(git log --oneline -1)"
echo -e "${YELLOW}Service:${NC} $(systemctl is-active levcon-staging)"
echo -e "${YELLOW}URL:${NC} https://staging.levcon.ai"

exit 0

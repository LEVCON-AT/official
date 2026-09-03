#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  LEVCON.AI STAGING — HTPASSWD SETUP SCRIPT
#  Erstellt .htpasswd-Datei für nginx Basic Auth auf Staging
# ═══════════════════════════════════════════════════════════════
#
#  Ausführung:
#    ssh root@87.106.25.91
#    cd /var/www/levcon
#    git pull origin main
#    bash deploy/staging/setup-staging-auth.sh [USERNAME] [PASSWORD]
#
#  Beispiele:
#    bash deploy/staging/setup-staging-auth.sh              # Interaktiv (fragt ab)
#    bash deploy/staging/setup-staging-auth.sh levcon       # User: levcon, Passwort wird abgefragt
#    bash deploy/staging/setup-staging-auth.sh levcon mypw  # User + Passwort direkt
#
#  Was dieses Skript macht:
#  1. Installiert apache2-utils (für htpasswd) falls fehlt
#  2. Erstellt /etc/nginx/.htpasswd.levcon-staging
#  3. Fügt User hinzu (oder überschreibt mit -c)
#  4. Setzt Permissions (root:www-data, 640)
#  5. Reloaded nginx (Basic Auth sofort aktiv)
#
#  WICHTIG: API-Endpunkte (/api/*) sind NICHT durch Basic Auth geschützt!
#  Sie verwenden LEVCON_INTERNAL_API_KEY (X-Levcon-Api-Key Header).
#  So kann n8n weiterhin auf Staging-API zugreifen.
#  Siehe deploy/nginx/staging.levcon.ai.conf für Details.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

HTPASSWD_FILE="/etc/nginx/.htpasswd.levcon-staging"

echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  LEVCON.AI — STAGING AUTH SETUP${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

# ── 0. PRE-CHECKS ──────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Dieses Skript muss als root ausgeführt werden.${NC}"
   exit 1
fi

# ── 1. apache2-utils installieren (enthält htpasswd) ──────────
echo -e "\n${YELLOW}[1] Prüfe apache2-utils (für htpasswd)...${NC}"

if ! command -v htpasswd &> /dev/null; then
    echo "  apache2-utils fehlt — wird installiert..."
    apt-get update -qq
    apt-get install -y -qq apache2-utils
    echo -e "${GREEN}  ✅ apache2-utils installiert${NC}"
else
    echo -e "${GREEN}  ✅ htpasswd bereits verfügbar${NC}"
fi

# ── 2. USERNAME + PASSWORD bestimmen ───────────────────────────
echo -e "\n${YELLOW}[2] User und Passwort bestimmen...${NC}"

USERNAME="${1:-}"
PASSWORD="${2:-}"

if [ -z "$USERNAME" ]; then
    read -p "  Username für Staging-Zugang (default: levcon): " USERNAME
    USERNAME="${USERNAME:-levcon}"
fi

if [ -z "$PASSWORD" ]; then
    # Interaktiv mit versteckter Eingabe
    read -s -p "  Passwort für User '$USERNAME': " PASSWORD
    echo ""
    if [ -z "$PASSWORD" ]; then
        echo -e "${RED}  ❌ Passwort darf nicht leer sein${NC}"
        exit 1
    fi
    read -s -p "  Passwort wiederholen: " PASSWORD2
    echo ""
    if [ "$PASSWORD" != "$PASSWORD2" ]; then
        echo -e "${RED}  ❌ Passwörter stimmen nicht überein${NC}"
        exit 1
    fi
fi

# ── 3. htpasswd-Datei erstellen ────────────────────────────────
echo -e "\n${YELLOW}[3] htpasswd-Datei erstellen...${NC}"

# Falls Datei schon existiert: User aktualisieren (nicht überschreiben!)
if [ -f "$HTPASSWD_FILE" ]; then
    echo "  $HTPASSWD_FILE existiert bereits"
    echo "  Aktuelle User:"
    cut -d: -f1 "$HTPASSWD_FILE" | sed 's/^/    - /'
    echo ""
    # User hinzufügen (ohne -c, sonst werden andere User gelöscht)
    htpasswd -bB "$HTPASSWD_FILE" "$USERNAME" "$PASSWORD"
    echo -e "${GREEN}  ✅ User '$USERNAME' hinzugefügt/aktualisiert (bcrypt-Verschlüsselung)${NC}"
else
    # Neue Datei erstellen (-c für create)
    htpasswd -bcB "$HTPASSWD_FILE" "$USERNAME" "$PASSWORD"
    echo -e "${GREEN}  ✅ $HTPASSWD_FILE erstellt mit User '$USERNAME' (bcrypt)${NC}"
fi

# ── 4. PERMISSIONS ─────────────────────────────────────────────
echo -e "\n${YELLOW}[4] Permissions setzen...${NC}"

chown root:www-data "$HTPASSWD_FILE"
chmod 640 "$HTPASSWD_FILE"

echo "  Owner: $(stat -c '%U:%G' $HTPASSWD_FILE)"
echo "  Perms: $(stat -c '%a' $HTPASSWD_FILE)"
echo -e "${GREEN}  ✅ Permissions gesetzt${NC}"

# ── 5. NGINX RELOAD ───────────────────────────────────────────
echo -e "\n${YELLOW}[5] Nginx config testen + reloaden...${NC}"

if nginx -t 2>&1; then
    systemctl reload nginx
    echo -e "${GREEN}  ✅ Nginx reloaded — Basic Auth jetzt aktiv${NC}"
else
    echo -e "${RED}  ❌ Nginx config test fehlgeschlagen!${NC}"
    exit 1
fi

# ── 6. VERIFIKATION ────────────────────────────────────────────
echo -e "\n${YELLOW}[6] Verifikation...${NC}"

echo ""
echo -e "${BLUE}Test 1: Staging ohne Credentials → sollte 401 sein${NC}"
curl -sSI --max-time 10 https://staging.levcon.ai/ | head -3

echo ""
echo -e "${BLUE}Test 2: Staging mit Credentials → sollte 200 sein${NC}"
curl -sSI --max-time 10 -u "$USERNAME:$PASSWORD" https://staging.levcon.ai/ | head -3

echo ""
echo -e "${BLUE}Test 3: API-Endpunkt ohne Basic Auth (nur API-Key nötig)${NC}"
curl -sSI --max-time 10 https://staging.levcon.ai/api/ai-news/quality-report | head -3
echo "  → 401 = Route existiert, aber API-Key fehlt (erwünscht)"

echo ""
echo -e "${BLUE}Test 4: Static Asset ohne Basic Auth (sollte frei sein)${NC}"
curl -sSI --max-time 10 https://staging.levcon.ai/_next/static/chunks/ 2>&1 | head -3
echo "  → 200 oder 404 von Next.js ist OK (aber NICHT 401 Basic Auth)"

# ── 7. FINAL ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  STAGING AUTH ERFOLGREICH EINGERICHTET! 🔒${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

echo ""
echo -e "${BLUE}Login-Daten (bitte sicher speichern):${NC}"
echo "  URL:      https://staging.levcon.ai"
echo "  Username: $USERNAME"
echo "  Passwort: (versteckt)"

echo ""
echo -e "${BLUE}Browser-Zugriff:${NC}"
echo "  Browser öffnen → Basic Auth Dialog → User + Passwort eingeben"
echo "  Danach: Session bleibt aktiv (Cookie), kein wiederholtes Login"

echo ""
echo -e "${BLUE}API-Zugriff (für n8n, curl, etc.):${NC}"
echo "  Keine Basic Auth nötig!"
echo "  Stattdessen: X-Levcon-Api-Key Header"
echo ""
echo "  Beispiel:"
echo "    curl -H 'X-Levcon-Api-Key: <KEY>' https://staging.levcon.ai/api/ai-news/quality-report"

echo ""
echo -e "${BLUE}User verwalten:${NC}"
echo "  Neuen User hinzufügen:"
echo "    sudo bash /var/www/levcon/deploy/staging/setup-staging-auth.sh <neuer-user>"
echo ""
echo "  User entfernen:"
echo "    sudo htpasswd -D /etc/nginx/.htpasswd.levcon-staging <user>"
echo "    sudo systemctl reload nginx"
echo ""
echo "  Passwort ändern:"
echo "    sudo htpasswd -B /etc/nginx/.htpasswd.levcon-staging <user>"
echo "    sudo systemctl reload nginx"

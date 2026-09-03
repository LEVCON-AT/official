#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  LEVCON.AI — STAGING PREFLIGHT CHECK
#  Sammelt alle Infos, die für das Staging-Setup wichtig sind
# ═══════════════════════════════════════════════════════════════
#  Ausführen auf VPS:  bash staging-preflight.sh
#  Output: kommando-fertige Diagnose

set +e

echo "════════════════════════════════════════════════════════════════"
echo "  LEVCON.AI — STAGING PREFLIGHT CHECK"
echo "  Hostname: $(hostname)"
echo "  Datum:    $(date)"
echo "════════════════════════════════════════════════════════════════"

# ── 1. DNS-CHECK: staging.levcon.ai (kritisch für SSL!) ─────────
echo ""
echo "╔══ 1. DNS-CHECK: staging.levcon.ai ══════════════════════════╗"
echo "Prüfe ob staging.levcon.ai auf diese IP zeigt..."
echo ""
echo "VPS öffentliche IP (ermittelt):"
PUBLIC_IP=$(curl -sS --max-time 5 https://api.ipify.org 2>/dev/null)
echo "  VPS-IP: $PUBLIC_IP"
echo ""
echo "DNS-Auflösung staging.levcon.ai:"
STAGING_IP=$(dig +short staging.levcon.ai 2>/dev/null | head -1)
echo "  staging.levcon.ai → $STAGING_IP"
if [ -n "$STAGING_IP" ] && [ "$STAGING_IP" = "$PUBLIC_IP" ]; then
    echo "  ✅ DNS korrekt — staging.levcon.ai zeigt auf diesen VPS"
    DNS_OK=1
else
    echo "  ❌ DNS FEHLT oder falsch — staging.levcon.ai muss auf $PUBLIC_IP zeigen"
    echo "     → A-Record bei IONOS anlegen: staging → $PUBLIC_IP"
    DNS_OK=0
fi

# ── 2. PRODUCTION-STATUS (muss laufen, damit Setup möglich) ──────
echo ""
echo "╔══ 2. PRODUCTION-STATUS ══════════════════════════════════════╗"
echo "Production /var/www/levcon vorhanden?"
if [ -d "/var/www/levcon" ]; then
    echo "  ✅ Ja"
    echo "  Commit: $(cd /var/www/levcon && git log --oneline -1 2>&1)"
    echo "  Branch: $(cd /var/www/levcon && git branch --show-current 2>&1)"
    echo "  Service: $(systemctl is-active levcon 2>&1)"
    PROD_OK=1
else
    echo "  ❌ Nein — Staging-Setup braucht Production als Voraussetzung!"
    PROD_OK=0
fi

# ── 3. STAGING BEREITS VORHANDEN? ───────────────────────────────
echo ""
echo "╔══ 3. STAGING BEREITS VORHANDEN? ═════════════════════════════╗"
if [ -d "/var/www/levcon-staging" ]; then
    echo "  ⚠ /var/www/levcon-staging existiert bereits!"
    echo "  Falls Neu-Setup: rm -rf /var/www/levcon-staging zuerst"
    STAGING_EXISTS=1
else
    echo "  ✅ /var/www/levcon-staging existiert nicht — Setup kann loslegen"
    STAGING_EXISTS=0
fi

# ── 4. BUN & GIT INSTALLATION ───────────────────────────────────
echo ""
echo "╔══ 4. WICHTIGE TOOLS ═════════════════════════════════════════╗"
echo "Bun:     $(bun --version 2>/dev/null || echo 'NICHT INSTALLIERT')"
echo "Node:    $(node --version 2>/dev/null || echo 'NICHT INSTALLIERT')"
echo "Git:     $(git --version 2>/dev/null || echo 'NICHT INSTALLIERT')"
echo "Nginx:   $(nginx -v 2>&1 | head -1 || echo 'NICHT INSTALLIERT')"
echo "Certbot: $(certbot --version 2>&1 || echo 'NICHT INSTALLIERT')"
echo "Sqlite3: $(sqlite3 --version 2>&1 | head -1 || echo 'NICHT INSTALLIERT')"

# ── 5. NGINX SITES — Was ist schon konfiguriert? ────────────────
echo ""
echo "╔══ 5. NGINX SITES ════════════════════════════════════════════╗"
echo "sites-available:"
ls -la /etc/nginx/sites-available/ 2>&1 | head -15
echo ""
echo "sites-enabled:"
ls -la /etc/nginx/sites-enabled/ 2>&1 | head -15
echo ""
echo "Default site noch aktiv? (sollte entfernt werden):"
if [ -L /etc/nginx/sites-enabled/default ]; then
    echo "  ⚠ /etc/nginx/sites-enabled/default existiert — kann Konflikte geben"
else
    echo "  ✅ Default site nicht aktiviert"
fi

# ── 6. PORT 3003 FREI? (für Staging-Next.js) ────────────────────
echo ""
echo "╔══ 6. PORT 3003 FREI? (für Staging Next.js) ═════════════════╗"
PORT_3003=$(ss -tlnp 2>&1 | grep ':3003 ' | head -1)
if [ -z "$PORT_3003" ]; then
    echo "  ✅ Port 3003 ist frei"
    PORT_FREE=1
else
    echo "  ❌ Port 3003 belegt: $PORT_3003"
    PORT_FREE=0
fi
echo ""
echo "Aktuelle Next.js-Ports:"
ss -tlnp 2>&1 | grep -E ':(300[0-5]) ' | head -5

# ── 7. SSL-ZERTIFIKATE — Welche Domains sind schon abgedeckt? ──
echo ""
echo "╔══ 7. SSL-ZERTIFIKATE (Let's Encrypt) ════════════════════════╗"
echo "Vorhandene Certs:"
ls -la /etc/letsencrypt/live/ 2>&1 | head -10
echo ""
echo "staging.levcon.ai Cert schon vorhanden?"
if [ -f "/etc/letsencrypt/live/staging.levcon.ai/fullchain.pem" ]; then
    echo "  ✅ Ja — Cert-Beantragung im Setup-Skript wird übersprungen"
    CERT_EXISTS=1
else
    echo "  ℹ Nein — Certbot muss es im Setup neu beantragen"
    CERT_EXISTS=0
fi

# ── 8. WWW-DATA USER (für systemd Service) ─────────────────────
echo ""
echo "╔══ 8. WWW-DATA USER ══════════════════════════════════════════╗"
if id "www-data" &>/dev/null; then
    echo "  ✅ www-data User existiert (UID: $(id -u www-data))"
else
    echo "  ❌ www-data User fehlt — muss angelegt werden"
fi

# ── 9. FIREWALL STATUS ─────────────────────────────────────────
echo ""
echo "╔══ 9. FIREWALL (UFW) ════════════════════════════════════════╗"
ufw status 2>&1 | head -10
echo ""
echo "WICHTIG: Port 80 + 443 müssen offen sein (für certbot + HTTPS)"

# ── 10. PRODUCTION .ENV (zum Vergleich für Staging) ────────────
echo ""
echo "╔══ 10. PRODUCTION .ENV (KEY-NAMEN NUR, WERTE VERBORGEN) ═════╗"
if [ -f "/var/www/levcon/.env" ]; then
    echo "Production-.env existiert ✅"
    echo "Keys (Werte verborgen):"
    while IFS= read -r line; do
        if [[ "$line" =~ ^[A-Z_]+ ]] && [[ "$line" == *"="* ]]; then
            key=$(echo "$line" | cut -d'=' -f1)
            value=$(echo "$line" | cut -d'=' -f2-)
            echo "    $key = <${#value} chars>"
        fi
    done < /var/www/levcon/.env
else
    echo "❌ Production-.env fehlt"
fi

# ── 11. PRODUCTION SMTP-CREDENTIALS (für Staging-Reuse?) ───────
echo ""
echo "╔══ 11. SMTP-CREDENTIALS (Production) ════════════════════════╗"
if [ -f "/var/www/levcon/.env" ]; then
    SMTP_HOST=$(grep "^SMTP_HOST=" /var/www/levcon/.env | cut -d'=' -f2- | tr -d '"')
    SMTP_USER=$(grep "^SMTP_USER=" /var/www/levcon/.env | cut -d'=' -f2- | tr -d '"')
    SMTP_PORT=$(grep "^SMTP_PORT=" /var/www/levcon/.env | cut -d'=' -f2- | tr -d '"')
    CONTACT_EMAIL=$(grep "^CONTACT_EMAIL=" /var/www/levcon/.env | cut -d'=' -f2- | tr -d '"')
    echo "  SMTP_HOST: $SMTP_HOST"
    echo "  SMTP_USER: $SMTP_USER"
    echo "  SMTP_PORT: $SMTP_PORT"
    echo "  CONTACT_EMAIL: $CONTACT_EMAIL"
    echo "  SMTP_PASS: <hidden — du kennst es aus Production>"
fi

# ── 12. PRODUCTION GIT REMOTE URL (zum Vergleich) ──────────────
echo ""
echo "╔══ 12. PRODUCTION GIT REMOTE URL ════════════════════════════╗"
echo "Production Remote:"
cd /var/www/levcon 2>/dev/null && git remote -v 2>&1
echo ""
echo "Staging-Setup wird SSH-Remote verwenden für:"
echo "  git@github.com:LEVCON-AT/official.git"

# ── 13. SYSTEMD SERVICE FILES ──────────────────────────────────
echo ""
echo "╔══ 13. SYSTEMD SERVICE FILES ════════════════════════════════╗"
echo "Vorhandene Levcon Services:"
ls -la /etc/systemd/system/levcon* 2>&1 | head -5

# ── 14. CERTBOT-PORT-CHECK (für SSL-Beantragung) ──────────────
echo ""
echo "╔══ 14. CERTBOT STANDALONE-PORT-CHECK ═══════════════════════╗"
echo "Certbot --standalone braucht Port 80 während Beantragung frei."
echo "Port 80 Status:"
PORT_80=$(ss -tlnp 2>&1 | grep ':80 ' | head -1)
if [ -n "$PORT_80" ]; then
    echo "  Port 80 belegt durch: $PORT_80"
    echo "  → Setup-Skript wird nginx stoppen für Cert-Beantragung"
else
    echo "  ✅ Port 80 ist frei"
fi

# ── 15. FAZIT & SETUP-READINESS ┐═══════════════════════════════
echo ""
echo "╔══ 15. STAGING-SETUP-READINESS ═══════════════════════════════╗"
echo "Setup kann starten wenn ALLE Conditions erfüllt sind:"
echo ""
[ "$DNS_OK" = "1" ] && echo "  ✅ DNS: staging.levcon.ai → $PUBLIC_IP" || echo "  ❌ DNS: staging.levcon.ai → muss noch angelegt werden"
[ "$PROD_OK" = "1" ] && echo "  ✅ Production läuft" || echo "  ❌ Production fehlt"
[ "$STAGING_EXISTS" = "0" ] && echo "  ✅ /var/www/levcon-staging existiert nicht (sauberer Start)" || echo "  ⚠ /var/www/levcon-staging existiert (rm -rf vorher)"
[ "$PORT_FREE" = "1" ] && echo "  ✅ Port 3003 frei" || echo "  ❌ Port 3003 belegt"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  PREFLIGHT ENDE"
echo "════════════════════════════════════════════════════════════════"

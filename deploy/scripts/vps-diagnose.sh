#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  LEVCON.AI — VPS DIAGNOSE SKRIPT
#  Sammelt alle Infos um GitHub-Actions-Deploy-Fehler zu finden
# ═══════════════════════════════════════════════════════════════
#
#  Verwendung auf VPS:
#    bash vps-diagnose.sh
#
#  Oder mit Output in Datei:
#    bash vps-diagnose.sh > diagnose-output.txt 2>&1
#
#  WICHTIG: Dieses Skript gibt KEINE Secrets aus!
#  .env-Inhalte werden nur als "exists: yes/no" + length angezeigt.

set +e  # nicht abbrechen bei Fehlern — wir wollen alle Infos

echo "════════════════════════════════════════════════════════════════"
echo "  LEVCON.AI — VPS DIAGNOSE"
echo "  Hostname: $(hostname)"
echo "  Datum:    $(date)"
echo "════════════════════════════════════════════════════════════════"

# ── 1. SYSTEM INFO ──────────────────────────────────────────────
echo ""
echo "╔══ 1. SYSTEM INFO ═══════════════════════════════════════════╗"
echo "Hostname:       $(hostname)"
echo "OS:             $(cat /etc/os-release 2>/dev/null | grep '^PRETTY_NAME=' | cut -d'=' -f2 | tr -d '"')"
echo "Kernel:         $(uname -r)"
echo "Arch:           $(uname -m)"
echo "Uptime:         $(uptime -p)"
echo "Aktueller User: $(whoami)  (UID: $(id -u))"
echo "Working Dir:    $(pwd)"
echo "Bun Version:    $(bun --version 2>/dev/null || echo 'NOT INSTALLED')"
echo "Node Version:   $(node --version 2>/dev/null || echo 'NOT INSTALLED')"
echo "Git Version:    $(git --version 2>/dev/null || echo 'NOT INSTALLED')"
echo "SSH Version:    $(ssh -V 2>&1 | head -1)"
echo "Memory:         $(free -h | grep Mem | awk '{print $2 " total, " $7 " available"}')"
echo "Disk:           $(df -h / | tail -1 | awk '{print $2 " total, " $4 " free, " $5 " used"}')"

# ── 2. LEVCON PROJECT DIRECTORY ─────────────────────────────────
echo ""
echo "╔══ 2. LEVCON PROJECT DIRECTORY ═════════════════════════════╗"
if [ -d "/var/www/levcon" ]; then
    echo "✓ /var/www/levcon existiert"
    echo "  Owner: $(stat -c '%U:%G' /var/www/levcon)"
    echo "  Perms: $(stat -c '%a' /var/www/levcon)"
    echo "  Size:  $(du -sh /var/www/levcon 2>/dev/null | awk '{print $1}')"
    echo ""
    echo "  Top-Level Contents:"
    ls -la /var/www/levcon 2>&1 | head -20
    echo ""
    echo "  .next/ Verzeichnis:"
    if [ -d "/var/www/levcon/.next" ]; then
        echo "  ✓ .next/ existiert"
        if [ -d "/var/www/levcon/.next/standalone" ]; then
            echo "  ✓ .next/standalone/ existiert"
            ls -la /var/www/levcon/.next/standalone/server.js 2>&1 | head -2
        else
            echo "  ✗ .next/standalone/ FEHLT (Build nicht fertig?)"
        fi
    else
        echo "  ✗ .next/ FEHLT (noch nie gebaut?)"
    fi
else
    echo "✗ /var/www/levcon existiert NICHT"
fi

# ── 3. STAGING DIRECTORY CHECK ──────────────────────────────────
echo ""
echo "╔══ 3. STAGING DIRECTORY CHECK ════════════════════════════════╗"
if [ -d "/var/www/levcon-staging" ]; then
    echo "✓ /var/www/levcon-staging existiert (Staging schon eingerichtet)"
else
    echo "ℹ /var/www/levcon-staging existiert nicht (Staging noch nicht eingerichtet — OK)"
fi

# ── 4. GIT REMOTE URL (CRITICAL!) ───────────────────────────────
echo ""
echo "╔══ 4. GIT REMOTE URL (CRITICAL) ═════════════════════════════╗"
cd /var/www/levcon 2>/dev/null
if [ $? -ne 0 ]; then
    echo "✗ Kann nicht nach /var/www/levcon wechseln"
else
    echo "Git Remote URLs in /var/www/levcon:"
    git remote -v 2>&1
    echo ""
    echo "Aktueller Branch:"
    git branch --show-current 2>&1
    echo ""
    echo "Letzte 5 Commits:"
    git log --oneline -5 2>&1
    echo ""
    echo "Git Status (kurz):"
    git status -sb 2>&1 | head -10
    echo ""
    echo "Git Config (nur levcon-relevant):"
    git config --local --list 2>&1 | grep -iE "remote|user|safe" | head -10
fi

# ── 5. SSH-KEYS UND CONFIG ──────────────────────────────────────
echo ""
echo "╔══ 5. SSH-KEYS UND CONFIG ════════════════════════════════════╗"
echo "~/.ssh/ Verzeichnis:"
ls -la ~/.ssh 2>&1 | head -20
echo ""
echo "~/.ssh/config (falls existiert):"
if [ -f ~/.ssh/config ]; then
    cat ~/.ssh/config 2>&1 | head -30
else
    echo "  ✗ ~/.ssh/config existiert NICHT"
fi
echo ""
echo "Public Keys (nur .pub — sicher zum teilen):"
for f in ~/.ssh/*.pub; do
    if [ -f "$f" ]; then
        echo "  $f:"
        echo "    $(cat $f)"
    fi
done
echo ""
echo "known_hosts (github.com Einträge):"
grep -i "github.com" ~/.ssh/known_hosts 2>&1 | head -5 || echo "  ✗ Kein github.com in known_hosts"

# ── 6. SSH VERBINDUNG ZU GITHUB TESTEN ──────────────────────────
echo ""
echo "╔══ 6. SSH VERBINDUNG ZU GITHUB TESTEN ════════════════════════╗"
echo "Teste: ssh -T git@github.com"
ssh -T git@github.com 2>&1 | head -5
echo ""
echo "Teste mit verbose (-v) um zu sehen welcher Key genutzt wird:"
ssh -T -v git@github.com 2>&1 | grep -iE "offering|accepted|publickey|authenticated|permission denied|connection closed" | head -10

# ── 7. GITHUB REPO CLONE-TEST (HTTPS vs SSH) ────────────────────
echo ""
echo "╔══ 7. CLONE-TEST (HTTPS vs SSH) ══════════════════════════════╗"
echo "HTTPS Clone-Test (anonym, sollte bei public repo funktionieren):"
timeout 10 git ls-remote https://github.com/LEVCON-AT/official.git HEAD 2>&1 | head -3
echo ""
echo "SSH Clone-Test:"
timeout 10 git ls-remote git@github.com:LEVCON-AT/official.git HEAD 2>&1 | head -3

# ── 8. SYSTEMD SERVICES ─────────────────────────────────────────
echo ""
echo "╔══ 8. SYSTEMD SERVICES ═══════════════════════════════════════╗"
echo "levcon service:"
systemctl status levcon --no-pager 2>&1 | head -10
echo ""
echo "levcon-staging service (falls vorhanden):"
systemctl status levcon-staging --no-pager 2>&1 | head -5
echo ""
echo "nginx service:"
systemctl status nginx --no-pager 2>&1 | head -5
echo ""
echo "Service-Files installiert:"
ls -la /etc/systemd/system/levcon* 2>&1

# ── 9. .ENV DATEI (ohne Secrets!) ────────────────────────────────
echo ""
echo "╔══ 9. .ENV DATEI (SECRET-FREIE ANSICHT) ══════════════════════╗"
if [ -f "/var/www/levcon/.env" ]; then
    echo "✓ /var/www/levcon/.env existiert"
    echo "  Owner: $(stat -c '%U:%G' /var/www/levcon/.env)"
    echo "  Perms: $(stat -c '%a' /var/www/levcon/.env)"
    echo "  Size:  $(stat -c '%s' /var/www/levcon/.env) bytes"
    echo "  Lines: $(wc -l < /var/www/levcon/.env)"
    echo ""
    echo "  Enthaltene Keys (nur Key-Namen, Werte verborgen):"
    # Nur Key-Namen ausgeben, Werte als <hidden> oder Länge
    while IFS= read -r line; do
        if [[ "$line" =~ ^[A-Z_]+ ]] && [[ "$line" == *"="* ]]; then
            key=$(echo "$line" | cut -d'=' -f1)
            value=$(echo "$line" | cut -d'=' -f2-)
            # Value-Länge statt Inhalt
            echo "    $key = <hidden, ${#value} chars>"
        fi
    done < /var/www/levcon/.env
else
    echo "✗ /var/www/levcon/.env existiert NICHT"
fi

# ── 10. DATABASE STATUS ─────────────────────────────────────────
echo ""
echo "╔══ 10. DATABASE STATUS ═══════════════════════════════════════╗"
echo "DB-Verzeichnis /var/www/levcon/db/:"
ls -la /var/www/levcon/db 2>&1 | head -10
echo ""
echo "DB-Datei-Größe(n):"
du -h /var/www/levcon/db/*.db 2>/dev/null
echo ""
echo "DB-Schema Prüfung (workflow_runs Tabelle):"
if [ -f "/var/www/levcon/db/levcon.db" ]; then
    sqlite3 /var/www/levcon/db/levcon.db ".schema workflow_runs" 2>&1 | head -25
    echo ""
    echo "Anzahl WorkflowRuns:"
    sqlite3 /var/www/levcon/db/levcon.db "SELECT COUNT(*) FROM workflow_runs;" 2>&1
    echo ""
    echo "Letzte 5 WorkflowRuns:"
    sqlite3 /var/www/levcon/db/levcon.db "SELECT id, runAt, status, itemCount FROM workflow_runs ORDER BY id DESC LIMIT 5;" 2>&1
fi

# ── 11. NGINX CONFIG ┐═══════════════════════════════════════════
echo ""
echo "╔══ 11. NGINX CONFIG ══════════════════════════════════════════╗"
echo "Sites-available:"
ls -la /etc/nginx/sites-available/ 2>&1 | head -10
echo ""
echo "Sites-enabled:"
ls -la /etc/nginx/sites-enabled/ 2>&1 | head -10
echo ""
echo "levcon.ai Config (ersten 30 Zeilen):"
head -30 /etc/nginx/sites-available/levcon.ai 2>&1
echo ""
echo "staging.levcon.ai Config (falls vorhanden):"
if [ -f "/etc/nginx/sites-available/staging.levcon.ai" ]; then
    head -10 /etc/nginx/sites-available/staging.levcon.ai 2>&1
else
    echo "  ✗ staging.levcon.ai config fehlt"
fi
echo ""
echo "nginx -t (Config Test):"
nginx -t 2>&1

# ── 12. SSL CERTIFICATES ────────────────────────────────────────
echo ""
echo "╔══ 12. SSL CERTIFICATES ══════════════════════════════════════╗"
echo "Let's Encrypt Certs:"
ls -la /etc/letsencrypt/live/ 2>&1 | head -10
echo ""
echo "levcon.ai Cert:"
if [ -f "/etc/letsencrypt/live/levcon.ai/fullchain.pem" ]; then
    echo "  ✓ levcon.ai cert existiert"
    echo "  Expires: $(openssl x509 -enddate -noout -in /etc/letsencrypt/live/levcon.ai/fullchain.pem 2>&1)"
else
    echo "  ✗ levcon.ai cert fehlt"
fi
echo ""
echo "staging.levcon.ai Cert:"
if [ -f "/etc/letsencrypt/live/staging.levcon.ai/fullchain.pem" ]; then
    echo "  ✓ staging.levcon.ai cert existiert"
else
    echo "  ℹ staging.levcon.ai cert nicht vorhanden (Staging noch nicht eingerichtet — OK)"
fi

# ── 13. APP ERREICHBARKEIT ──────────────────────────────────────
echo ""
echo "╔══ 13. APP ERREICHBARKEIT ════════════════════════════════════╗"
echo "Intern (Port 3002):"
curl -sSI --max-time 5 http://127.0.0.1:3002/ 2>&1 | head -5
echo ""
echo "Intern /api/ai-news/quality-report:"
curl -sSI --max-time 5 http://127.0.0.1:3002/api/ai-news/quality-report 2>&1 | head -3
echo ""
echo "Extern https://levcon.ai/:"
curl -sSI --max-time 10 https://levcon.ai/ 2>&1 | head -5
echo ""
echo "Extern /api/ai-news/quality-report:"
curl -sSI --max-time 10 https://levcon.ai/api/ai-news/quality-report 2>&1 | head -3
echo ""
echo "Extern /robots.txt:"
curl -sS --max-time 10 https://levcon.ai/robots.txt 2>&1 | head -5

# ── 14. LEVCON LOGS (LETZTE ERRORS) ─────────────────────────────
echo ""
echo "╔══ 14. LEVCON LOGS (LETZTE FEHLER) ═══════════════════════════╗"
echo "systemctl journal levcon (letzte 30 Zeilen, nur Errors/Warns):"
journalctl -u levcon --no-pager -n 100 2>&1 | grep -iE "error|warn|fail|fatal" | tail -20
echo ""
echo "nginx error.log (letzte 10 Zeilen):"
tail -10 /var/log/nginx/levcon.ai.error.log 2>&1

# ── 15. DEPLOY SKRIPT PRÜFUNG ───────────────────────────────────
echo ""
echo "╔══ 15. DEPLOY SKRIPT PRÜFUNG ════════════════════════════════╗"
echo "deploy/scripts/vps-update.sh existiert?"
if [ -f "/var/www/levcon/deploy/scripts/vps-update.sh" ]; then
    echo "  ✓ existiert"
    echo "  Erste 20 Zeilen:"
    head -20 /var/www/levcon/deploy/scripts/vps-update.sh 2>&1
else
    echo "  ✗ FEHLT"
fi
echo ""
echo "deploy/staging/vps-setup-staging.sh existiert?"
if [ -f "/var/www/levcon/deploy/staging/vps-setup-staging.sh" ]; then
    echo "  ✓ existiert"
else
    echo "  ✗ FEHLT (Staging noch nicht eingerichtet — OK falls nicht gewünscht)"
fi

# ── 16. GITHUB ACTIONS WORKFLOW FILES ───────────────────────────
echo ""
echo "╔══ 16. GITHUB ACTIONS WORKFLOW FILES ═════════════════════════╗"
echo ".github/workflows/ Inhalt:"
ls -la /var/www/levcon/.github/workflows/ 2>&1 | head -10
echo ""
echo "deploy.yml Trigger-Konfiguration:"
grep -A 5 "^on:" /var/www/levcon/.github/workflows/deploy.yml 2>&1 | head -10

# ── 17. GITHUB API STATUS CHECK (ohne Token) ────────────────────
echo ""
echo "╔══ 17. GITHUB API STATUS ═════════════════════════════════════╗"
echo "Repo-Status (anonym):"
curl -sS --max-time 10 https://api.github.com/repos/LEVCON-AT/official 2>&1 | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(f\"  Repo: {data.get('full_name', 'NOT FOUND')}\")
    print(f\"  Private: {data.get('private', '?')}\")
    print(f\"  Default branch: {data.get('default_branch', '?')}\")
    print(f\"  Has issues: {data.get('has_issues', '?')}\")
    print(f\"  Updated at: {data.get('updated_at', '?')}\")
    if 'message' in data:
        print(f\"  API Message: {data.get('message')}\")
except Exception as e:
    print(f'Could not parse: {e}')
" 2>&1
echo ""
echo "Letzte GitHub Actions Runs (anonym, funktioniert nur bei öffentlichen Repos):"
curl -sS --max-time 10 "https://api.github.com/repos/LEVCON-AT/official/actions/runs?per_page=3" 2>&1 | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    runs = data.get('workflow_runs', [])
    print(f'  Total runs: {len(runs)}')
    for run in runs[:3]:
        print(f\"    {run.get('status','?'):>12} | {str(run.get('conclusion') or '-'):>10} | {run.get('name','?'):<30} | {run.get('created_at','?')[:19]}\")
    if 'message' in data:
        print(f\"  Message: {data.get('message')}\")
except Exception as e:
    print(f'Could not parse: {e}')
" 2>&1

# ── 18. CRON JOBS ───────────────────────────────────────────────
echo ""
echo "╔══ 18. CRON JOBS ═════════════════════════════════════════════╗"
echo "Levcon-spezifische Cron-Jobs:"
ls -la /etc/cron.d/levcon* 2>&1
echo ""
echo "Cron-Status:"
systemctl is-active cron 2>&1

# ── 19. FIREWALL ───────────────────────────────────────────────
echo ""
echo "╔══ 19. FIREWALL (UFW) ════════════════════════════════════════╗"
ufw status 2>&1 | head -15

# ── 20. NETWORK PORTS ┐══════════════════════════════════════════
echo ""
echo "╔══ 20. NETWORK PORTS ══════════════════════════════════════════╗"
echo "Listening Ports (3000-3005 + 80 + 443):"
ss -tlnp 2>&1 | grep -E ":(300[0-5]|80|443) " | head -10

# ── 21. DEPLOY KEY TEST (DETAILIERT) ────────────────────────────
echo ""
echo "╔══ 21. DEPLOY KEY TEST (DETAILLIERT) ═════════════════════════╗"
echo "Alle SSH-Keys mit Fingerprints:"
for f in ~/.ssh/id_* ~/.ssh/*_key; do
    if [ -f "$f" ] && [[ "$f" != *.pub ]]; then
        echo "  Private Key: $f"
        ssh-keygen -lf "$f" 2>&1 | head -1
    fi
done
echo ""
echo "Test mit explizitem Key (falls levcon_deploy_key existiert):"
if [ -f ~/.ssh/levcon_deploy_key ]; then
    echo "  Teste ssh -i ~/.ssh/levcon_deploy_key -T git@github.com:"
    ssh -i ~/.ssh/levcon_deploy_key -T git@github.com 2>&1 | head -3
    echo ""
    echo "  Teste git fetch mit explizitem Key:"
    GIT_SSH_COMMAND="ssh -i ~/.ssh/levcon_deploy_key -o StrictHostKeyChecking=no" \
        timeout 15 git ls-remote git@github.com:LEVCON-AT/official.git HEAD 2>&1 | head -3
else
    echo "  ✗ ~/.ssh/levcon_deploy_key existiert NICHT"
    echo "  Vorhandene Private Keys:"
    ls -la ~/.ssh/id_* 2>/dev/null | head -5
    ls -la ~/.ssh/*_key 2>/dev/null | head -5
fi

# ── 22. FAZIT & HINWEISE ────────────────────────────────────────
echo ""
echo "╔══ 22. DIAGNOSE-HINWEISE ═════════════════════════════════════╗"
echo "Häufige Probleme und wo nachzusehen ist:"
echo ""
echo "1. GITHUB ACTIONS FEHLER 'could not read Username':"
echo "   → Prüfe Abschnitt 4: Git Remote URL muss SSH sein (git@github.com:...)"
echo "   → Wenn HTTPS, ausführen: cd /var/www/levcon && git remote set-url origin git@github.com:LEVCON-AT/official.git"
echo ""
echo "2. Route 404 auf levcon.ai:"
echo "   → Prüfe Abschnitt 4: Commits müssen db1dff0 oder neuer zeigen"
echo "   → Prüfe Abschnitt 14: levcon logs auf Errors"
echo "   → Falls Build fehlgeschlagen: cd /var/www/levcon && bun run build"
echo ""
echo "3. SSH-Auth zu GitHub schlägt fehl:"
echo "   → Prüfe Abschnitt 6: 'ssh -T git@github.com' muss erfolgreich sein"
echo "   → Prüfe Abschnitt 5: Public Key bei GitHub hinterlegt?"
echo "   → Prüfe Abschnitt 21: Expliziter Key-Test"
echo ""
echo "4. Schema-Migration fehlt:"
echo "   → Prüfe Abschnitt 10: workflow_runs muss itemCountDe, retryCount etc. haben"
echo "   → Falls fehlt: cd /var/www/levcon && bun run db:push --accept-data-loss"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  DIAGNOSE ENDE"
echo "════════════════════════════════════════════════════════════════"

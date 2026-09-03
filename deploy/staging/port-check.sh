#!/bin/bash
# Quick port-finder für Levcon Staging
echo "=== Belegte Next.js/bun/node Ports (3000-3010) ==="
ss -tlnp 2>&1 | grep -E ':(300[0-9]|301[0-9]) ' | head -10
echo ""
echo "=== Prozesse auf 3004 ==="
ss -tlnp 2>&1 | grep ':3004 '
echo ""
echo "=== Prozess-Details (falls PID ermittelbar) ==="
PID=$(ss -tlnp 2>&1 | grep ':3004 ' | grep -oP 'pid=\K[0-9]+' | head -1)
if [ -n "$PID" ]; then
    echo "PID: $PID"
    ps -fp $PID
    ls -la /proc/$PID/cwd 2>/dev/null
else
    echo "Keine PID ermittelbar — Port gehört vermutlich systemd/Timer"
fi
echo ""
echo "=== systemd Services mit Port 3004 ==="
systemctl list-units --type=service --state=running | grep -iE "next|node|bun|levcon|neonfall|fincal|wyckoff|para3|matrix" | head -10
echo ""
echo "=== Freie Ports suchen (3005-3010) ==="
for PORT in 3005 3006 3007 3008 3009 3010; do
    if ss -tln | grep -q ":$PORT "; then
        echo "  $PORT: BELEGT"
    else
        echo "  $PORT: FREI ✅"
    fi
done

# Workflow Audit — Gegen N8N-PRODUCTION-STANDARDS.md

**Geprüft:** AI News — 01 Collect & Curate (Local LLM)
**Datum:** 2025-07-08
**Prüfer:** Claude Code (Self-Review)

---

## Kurz-Checkliste vor Go-Live

| # | Kriterium | Status | Bemerkung |
|---|---|---|---|
| 1 | Authentifizierung am Eingangspunkt vorhanden | ⚠️ TEILWEISE | Cron-Trigger hat keine Auth (OK für Cron). Webhook-Trigger für Newsletter/LinkedIn haben keine Auth — muss ergänzt werden. Interne API (Ingest) hat Header-Auth ✅ |
| 2 | Error-Workflow angebunden | ✅ ERLEDIGT | "On Workflow Error" → "Send Alert Email" vorhanden |
| 3 | Idempotenz sichergestellt (Dedup/Upsert) | ✅ ERLEDIGT | Ingest API löscht vorhandene Items des Tages vor Insert (Upsert per Date). Dedupe by URL Node vorhanden. |
| 4 | Checkpoint/Watermark für Backfill-Fähigkeit | ❌ FEHLT | Kein Watermark-Feld. Backfill nicht möglich — bei Ausfall fehlt der Tag. **Nachzuliefern in Sprint 10/13.** |
| 5 | Alerting bei Fehlschlag konfiguriert | ✅ ERLEDIGT | Alert Email an admin@levcon.at bei Error |
| 6 | Keine PII im Klartext in Logs/Alerts | ✅ ERLEDIGT | Alert Email enthält nur Workflow-Namen, keine Payload-Daten |
| 7 | Versionierung/Backup vor Änderungen | ⚠️ TEILWEISE | Workflow JSON im Git-Repo versioniert. Aber: n8n UI-Änderungen (wie Code-Node Updates) werden nicht automatisch ins Git exportiert. **Manueller Export nötig.** |
| 8 | Owner benannt | ✅ ERLEDIGT | Owner: Enric-Bernard Sep-Albi (Levcon.ai) |
| 9 | Dev/Staging/Prod sauber getrennt | ❌ FEHLT | Aktuell nur Prod. Kein Staging. **Backlog: Sprint 13** |
| 10 | Aufbewahrungsfristen/Pruning konfiguriert | ⚠️ TEILWEISE | Cleanup-Workflow löscht alte Subscriber (7/30 Tage). Aber: n8n Execution-Historie wird nicht gepruned. **n8n Pruning Policy setzen.** |

---

## Detaillierte Analyse

### 1. Sicherheit
- ✅ Credentials über n8n Credential Store (Header Auth, SMTP)
- ✅ HTTPS für alle externen URLs (levcon.ai API)
- ✅ Interne API durch `LEVCON_INTERNAL_API_KEY` geschützt
- ⚠️ Webhook-Trigger (LinkedIn, Newsletter) haben keine Authentifizierung — jemand könnte den Webhook aufrufen und den Workflow triggern
- **Action:** Webhook-Auth für LinkedIn/Newsletter Trigger hinzufügen (Header-Auth oder Secret in URL)

### 2. Fehlerbehandlung & Resilienz
- ✅ Zentraler Error-Trigger vorhanden
- ✅ Alert Email bei Fehlschlag
- ✅ Timeouts gesetzt (SearXNG: 30s, Ollama: 300s, Ingest: default)
- ❌ Kein Retry-on-Fail bei externen API-Calls (RSS, SearXNG, Ollama)
- ❌ Kein Circuit-Breaker
- **Action:** Retry-on-Fail für RSS + SearXNG aktivieren (3 Versuche, exponential backoff)

### 3. Umgang mit steckengebliebenen Workflows
- ❌ Kein Watchdog-Monitoring für hängende Executions
- ❌ Keine Dead-Letter-Queue
- ✅ Idempotenz: Ingest API löscht vorhandene Items vor Insert
- ✅ Manueller Re-Trigger möglich (Execute Workflow Button)
- ✅ Kill-Switch: Workflow kann deaktiviert werden (Toggle)
- **Action:** Watchdog-Workflow in Sprint 13 planen

### 4. Datennachlieferung / Backfill
- ❌ Kein Checkpoint/Watermark
- ❌ Kein Backfill-Modus
- **Action:** Watermark-Tabelle in Sprint 10/13 ergänzen. Bei Ausfall: manueller Re-Run mit angepasstem Datum.

### 5. Monitoring, Logging & Audit Trail
- ✅ Alert Email bei Fehlschlag
- ✅ WorkflowRun-Tabelle in DB (loggt成功的 Runs)
- ❌ Kein externes Uptime-Monitoring für n8n
- ❌ Keine persistente Execution-Log-Sicherung
- **Action:** Healthchecks.io oder Better Stack für n8n-Uptime in Sprint 13

### 6. Datenschutz (DSGVO)
- ✅ Datenminimierung: Nur E-Mail, Sprache, Frequenz bei Subscribers
- ✅ Keine PII in Alert-Emails
- ⚠️ n8n Execution-Historie könnte PII enthalten (RSS-Items mit Titeln)
- **Action:** n8n Execution Data Pruning aktivieren (z.B. 30 Tage)

### 7. Versionierung & Change Management
- ✅ Workflow JSON im Git-Repo versioniert
- ⚠️ Manuelle Änderungen in n8n UI werden nicht auto-exportiert
- ❌ Keine Dev/Staging/Prod-Trennung
- **Action:** Staging in Sprint 13. Workflow-Export nach jeder Änderung.

### 8. Betrieb & Skalierung
- ✅ Single-Instance OK für aktuelles Volumen
- ✅ Rate-Limiting durch Cleanup-Workflow
- ⚠️ n8n DB-Wachstum nicht überwacht
- **Action:** Pruning-Policy setzen, DB-Größe monatlich prüfen

### 9. Wartbarkeit
- ✅ Einheitliche Naming-Conventions (z.B. "Fetch Heise RSS", "Normalize RSS Items")
- ✅ Sticky Notes / Notes an Nodes
- ✅ Owner dokumentiert
- ⚠️ Keine "Letzte Änderung" Notes
- **Action:** Bei jeder Änderung Note aktualisieren

### 10. Referenzrahmen / Normen
- ✅ OWASP: HTTPS, Header-Auth, Input-Validierung
- ✅ DSGVO Art. 5: Datenminimierung
- ✅ DSGVO Art. 32: SSL, Credentials verschlüsselt
- ⚠️ ISO 27001: Change Management fehlt (kein Staging)
- **Action:** Staging für formale ISO-Konformität in Sprint 13

---

## Zusammenfassung: Action Items

### Sofort (Sprint 9)
1. **Retry-on-Fail** für RSS + SearXNG Nodes aktivieren (3 Versuche, 5s Wait)

### Sprint 10
2. **Webhook-Auth** für Newsletter/LinkedIn Trigger hinzufügen

### Sprint 13 (Polish & Stabilisierung)
3. **n8n Execution Pruning** aktivieren (30 Tage)
4. **Watchdog-Workflow** für hängende Executions
5. **Uptime-Monitoring** (Healthchecks.io)
6. **Staging-Infrastruktur** (Dev/Staging/Prod Trennung)
7. **Watermark/Backfill** für Datennachlieferung
8. **Workflow-Export** nach jeder n8n UI-Änderung ins Git-Repo

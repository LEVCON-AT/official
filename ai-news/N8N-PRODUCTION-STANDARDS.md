# n8n Produktions-Standards & Best Practices Leitfaden

Allgemeiner Referenzrahmen für den Entwurf produktiver n8n-Workflows und angebundener Systeme. Dient als Checkliste bei jedem neuen Workflow-Design.

---

## 1. Sicherheit

- Webhook-Authentifizierung: Header-Auth, HMAC-Signatur oder Basic Auth statt offener Endpoints
- Credentials ausschließlich über n8n Credential Store / Vault, nie hardcoded oder in Sticky Notes
- Least-Privilege: API-Keys nur mit den tatsächlich benötigten Scopes
- Input-Validierung/Sanitizing an jeder externen Eingabeschnittstelle (Formulare, Webhooks)
- HTTPS erzwingen, keine sensiblen Daten in URL-Query-Parametern
- Getrennte Credentials pro Umgebung (Dev/Staging/Prod) – niemals Prod-Keys in Test-Workflows

## 2. Fehlerbehandlung & Resilienz

- Zentraler Error-Workflow (Error Trigger Node), an den alle Prod-Workflows angebunden sind
- Retry-on-Fail mit exponentiellem Backoff bei externen API-Calls
- Try/Catch-Pattern über „Continue On Fail" + nachgelagerte IF-Verzweigung
- Timeout je Node explizit setzen, damit nichts unbegrenzt hängt
- Circuit-Breaker-Gedanke: bei wiederholtem Fehlschlag externer Systeme Workflow pausieren statt in Dauerschleife zu retryen

## 3. Umgang mit „steckengebliebenen" Workflows

Das ist der Bereich, der in vielen Setups fehlt und Betrieb schmerzhaft macht.

- **Detektion**: Monitoring auf Executions, die länger als ein definiertes Zeitfenster im Status „running" hängen (n8n API `/executions` regelmäßig abfragen, z. B. via separatem Watchdog-Workflow)
- **Dead-Letter-Prinzip**: Fehlgeschlagene/hängende Executions landen nicht im Nichts, sondern in einer „Dead-Letter-Queue" (eigene DB-Tabelle oder Board), aus der sie manuell oder automatisiert erneut angestoßen werden können
- **Idempotente Wiederaufnahme**: Jeder Workflow muss so gebaut sein, dass ein erneuter Lauf mit denselben Eingabedaten kein Duplikat erzeugt (Dedup-Key, z. B. externe ID + Zeitstempel, Upsert statt Insert)
- **Manuelle Re-Trigger-Fähigkeit**: Kritische Workflows sollten per Execute-Workflow-Node oder API mit denselben Payload-Daten erneut ausgelöst werden können, ohne die Originalquelle (z. B. Formular) erneut zu bemühen
- **Kill-Switch**: Möglichkeit, einen Workflow zentral zu deaktivieren (z. B. bei Downstream-Ausfall), ohne den n8n-Server anzuhalten

## 4. Datennachlieferung / Backfill

Wichtig bei Ausfällen, API-Downtime oder nachträglich erkannten Datenlücken.

- **Nachvollziehbare Zeitfenster**: Jeder Workflow sollte wissen (oder ermittelbar machen), welcher Zeitraum/welche Datensätze zuletzt erfolgreich verarbeitet wurden (Checkpoint/Watermark-Feld in einer Status-Tabelle)
- **Backfill-Modus**: Separater, manuell auslösbarer Workflow-Zweig, der einen definierten Zeitraum/eine Liste von IDs erneut verarbeitet, ohne die reguläre Trigger-Logik zu duplizieren
- **Quelle der Wahrheit**: Bei Systemunterbrechung muss klar sein, ob die Website/das Quellsystem selbst die Datenhistorie vorhält (dann ist Nachlieferung einfach: Zeitraum abfragen) oder ob Daten nur einmalig als Event durchlaufen (dann muss ein Zwischenspeicher/Log existieren, aus dem rekonstruiert werden kann)
- Differenzierung: **Fehlend** (nie angekommen) vs. **fehlerhaft verarbeitet** (angekommen, aber Prozess gescheitert) – unterschiedliche Recovery-Pfade

## 5. Monitoring, Logging & Audit Trail

- **Activity Log / Audit Trail**: Wer/was hat einen Workflow wann verändert, ausgelöst, deaktiviert? n8n Enterprise bietet dafür native Audit Logs; bei Community/Self-Hosted muss dies über Versionierung (siehe Punkt 7) und externes Logging kompensiert werden
- Jede produktive Execution sollte mindestens folgende Informationen persistent (außerhalb der n8n-internen Execution-Historie) festhalten: Trigger-Quelle, Zeitstempel, verarbeitete Datensatz-ID(s), Ergebnis-Status
- Execution-Logs bei Self-Hosting extern sichern bzw. exportieren – die interne n8n-DB ist kein Langzeit-Audit-Speicher
- Alerting bei Fehlschlägen: Slack/Teams/E-Mail-Notification mit Kontext (welcher Workflow, welcher Node, welche Payload-Referenz – keine Rohdaten mit PII im Klartext in Alerts)
- Externes Uptime-Monitoring für self-hosted n8n-Instanzen (z. B. Healthchecks.io, Better Stack)

## 6. Datenschutz (DSGVO)

- Datenminimierung: nur notwendige Felder verarbeiten/weiterleiten
- Keine personenbezogenen Daten im Klartext in Logs, Error-Notifications oder Alerts
- Aufbewahrungsfristen definieren und technisch umsetzen (Execution Data Pruning konfigurieren)
- Auftragsverarbeitungsvertrag (AVV) mit allen eingebundenen Drittanbietern (Mail-Provider, CRM, externe APIs)
- Löschkonzept: Wie wird ein Löschantrag über alle beteiligten Systeme hinweg (n8n-Executions, Zielsysteme, Backups) umgesetzt?

## 7. Versionierung & Change Management

- n8n Source-Control-Feature (Git-Integration) nutzen, wo verfügbar – jede Workflow-Änderung ist damit nachvollziehbar (= faktischer Audit Trail auf Workflow-Ebene)
- Ohne Git-Integration: manuelles Export/Backup vor jeder Änderung an produktiven Workflows, mit Zeitstempel und Änderungsgrund
- Klare Trennung Dev/Staging/Prod-Umgebungen, keine Live-Bearbeitung an Prod-Workflows
- Change-Log (auch simpel als Sticky Note oder separates Dokument): Was wurde wann geändert und warum

## 8. Betrieb & Skalierung

- Bei höherem Volumen: Queue Mode (Redis + Worker-Instanzen) statt Single-Instance-Betrieb
- Rate-Limiting/Batching + Wait-Nodes bei Massenverarbeitung, um Downstream-APIs nicht zu überlasten
- Health-Checks für die n8n-Instanz selbst (nicht nur für einzelne Workflows)
- Kapazitätsplanung: Execution-Historie-Wachstum der DB im Blick behalten (Pruning-Policy)

## 9. Wartbarkeit

- Einheitliche Naming-Conventions für Workflows und Nodes (z. B. `[Bereich]-[Funktion]-[Trigger-Typ]`)
- Dokumentation direkt im Workflow via Sticky Notes (Zweck, Verantwortlicher, letzte Änderung)
- Pin Data zum Testen, um Live-API-Calls beim Entwickeln zu vermeiden
- Jeder Workflow hat einen benannten Verantwortlichen (Owner), nicht nur „das Team"

## 10. Referenzrahmen / Normen

- **OWASP Top 10** als Orientierung für die Webhook-/API-Schicht
- **ISO 27001**-Prinzipien (Zugriffskontrolle, Protokollierung, Change Management) als strukturelle Orientierung, auch ohne formale Zertifizierung
- **DSGVO Art. 5** (Datenminimierung, Speicherbegrenzung) und **Art. 32** (Sicherheit der Verarbeitung)
- **ITIL 4**-Grundgedanken für Incident-/Change-Management, sofern der Workflow Teil eines größeren IT-Betriebsprozesses ist

---

## Kurz-Checkliste vor Go-Live eines neuen Workflows

- [ ] Authentifizierung am Eingangspunkt vorhanden
- [ ] Error-Workflow angebunden
- [ ] Idempotenz sichergestellt (Dedup/Upsert)
- [ ] Checkpoint/Watermark für Backfill-Fähigkeit vorhanden
- [ ] Alerting bei Fehlschlag konfiguriert
- [ ] Keine PII im Klartext in Logs/Alerts
- [ ] Versionierung/Backup vor Änderungen sichergestellt
- [ ] Owner benannt
- [ ] Dev/Staging/Prod sauber getrennt
- [ ] Aufbewahrungsfristen/Pruning konfiguriert

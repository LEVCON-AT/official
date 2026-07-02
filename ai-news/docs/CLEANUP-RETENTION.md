# Cleanup & Retention Jobs — AI News

**Status:** Documentation v1.0
**Last Updated:** 2025-07-01

Für DSGVO-Konformität und DB-Hygiene müssen periodisch alte Daten gelöscht werden.

---

## 1. Retention-Policy

| Datentyp | Aufbewahrung | Cleanup-Aktion |
|---|---|---|
| `AiNewsSummary` + `AiNewsItem` | 5 Jahre | Hard-Delete (Export vorab empfohlen) |
| `NewsletterSubscriber` (confirmed, active) | Unbegrenzt | Kein Auto-Cleanup |
| `NewsletterSubscriber` (unsubscribed) | 30 Tage | Hard-Delete nach 30 Tagen |
| `NewsletterSubscriber` (unconfirmed) | 7 Tage | Hard-Delete nach 7 Tagen |
| `WorkflowRun` | 90 Tage | Hard-Delete nach 90 Tagen |

---

## 2. n8n Cleanup-Workflow

**Empfehlung:** Ein zentraler n8n-Workflow, der täglich um 03:00 CET läuft und alle Cleanup-Aufgaben ausführt.

### Workflow-Struktur

```
[Cron: Täglich 03:00 CET]
        │
        ↓
[HTTP: DELETE /api/ai-news/internal/cleanup]
   Headers:
     X-Levcon-Api-Key: {{ $env.LEVCON_INTERNAL_API_KEY }}
   Body: {
     "olderThanDays": {
       "unconfirmed": 7,
       "unsubscribed": 30,
       "workflowRuns": 90
     }
   }
        │
        ↓
[Response Handling]
   - Bei Erfolg: Log an Alert-Email "Cleanup OK"
   - Bei Fehler: Alert-Email an Owner
```

### Cleanup-API-Endpoint

Die Next.js-App stellt einen internen Endpoint bereit:

**`POST /api/ai-news/internal/cleanup`**

```typescript
// Pseudocode
async function cleanupOldData(): Promise<{
  unconfirmedDeleted: number;
  unsubscribedDeleted: number;
  workflowRunsDeleted: number;
}> {
  const now = new Date();

  // 1. Delete unconfirmed subscribers older than 7 days
  const unconfirmedCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const unconfirmedDeleted = await db.newsletterSubscriber.deleteMany({
    where: {
      confirmedAt: null,
      createdAt: { lt: unconfirmedCutoff },
    },
  });

  // 2. Delete unsubscribed subscribers older than 30 days
  const unsubscribedCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const unsubscribedDeleted = await db.newsletterSubscriber.deleteMany({
    where: {
      unsubscribedAt: { lt: unsubscribedCutoff },
    },
  });

  // 3. Delete workflow runs older than 90 days
  const workflowRunsCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const workflowRunsDeleted = await db.workflowRun.deleteMany({
    where: {
      createdAt: { lt: workflowRunsCutoff },
    },
  });

  return {
    unconfirmedDeleted: unconfirmedDeleted.count,
    unsubscribedDeleted: unsubscribedDeleted.count,
    workflowRunsDeleted: workflowRunsDeleted.count,
  };
}
```

**Wichtig:** Dieser Endpoint muss mit `LEVCON_INTERNAL_API_KEY` geschützt sein!

---

## 3. News-Archiv-Aufräum-Job (jährlich, optional)

News-Daten älter als 5 Jahre sollten archiviert werden:

```
[Cron: Jährlich 1. Jänner 04:00 CET]
        │
        ↓
[HTTP: GET /api/ai-news/internal/archive-old]
   Headers: X-Levcon-Api-Key
        │
        ↓
[Function: Export als JSON-Datei]
        │
        ↓
[Write File: /backups/news-archive-YYYY.json]
        │
        ↓
[HTTP: DELETE /api/ai-news/internal/archive-old?confirmed=true]
```

---

## 4. DB-VACUUM (wöchentlich)

SQLite-Fragmentierung reduzieren:

```bash
# /etc/cron.weekly/levcon-vacuum
#!/bin/bash
sqlite3 /var/lib/levcon/levcon.db "VACUUM;"
echo "[$(date)] VACUUM completed" >> /var/log/levcon/vacuum.log
```

---

## 5. Monitoring

Jeder Cleanup-Lauf sollte im `WorkflowRun` geloggt werden:

```typescript
await db.workflowRun.create({
  data: {
    workflowId: 'cleanup-daily',
    runAt: new Date(),
    status: 'success',
    itemCount: result.unconfirmedDeleted + result.unsubscribedDeleted + result.workflowRunsDeleted,
  },
});
```

---

## 6. Implementierungs-Status

- [ ] Cleanup-API-Endpoint (`/api/ai-news/internal/cleanup`) in Sprint 8 implementieren
- [ ] n8n Cleanup-Workflow-JSON in Sprint 8 erstellen
- [ ] Cron-Jobs auf VPS einrichten

Bis dahin: Manuelle Cleanup-Queries möglich via Prisma Studio oder sqlite3 CLI.

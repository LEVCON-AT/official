# Sprint 1 — DB-Schema & Migration

**Status:** Pending
**Started:** —
**Finished:** —
**Paket-Typ:** Backend
**Aufwand:** 2-3h
**Abhängigkeit:** —

---

## Ziel

Erweiterung der bestehenden Prisma-Schema um die AI News-Modelle (`AiNewsSummary`, `AiNewsItem`, `NewsletterSubscriber`, `WorkflowRun`). Die Migration wird via `bun run db:push` angewendet. Danach sind Test-Inserts möglich, um die Schema-Validität zu bestätigen.

## Akzeptanzkriterien

- [ ] `prisma/schema.prisma` enthält alle 4 neuen Modelle gemäß `DATABASE-SCHEMA.md`
- [ ] `@map` Annotationen für snake_case Spaltennamen
- [ ] Indizes gesetzt (`@@index`, `@unique`)
- [ ] `bun run db:push` erfolgreich ohne Errors
- [ ] Tabellen in SQLite sichtbar (`.tables`)
- [ ] Test-Insert via Node-Script erfolgreich
- [ ] Test-Query (Join Summary + Items) erfolgreich
- [ ] Lint-Check: 0 Errors

## Implementierung

### Schritt 1: Schema editieren
- Bestehende `prisma/schema.prisma` öffnen
- 4 neue Modelle anfügen (Code aus `DATABASE-SCHEMA.md` übernehmen)
- Achtung: bestehende Modelle nicht verändern

### Schritt 2: Migration anwenden
```bash
cd /home/z/my-project
bun run db:push
```

### Schritt 3: Validierung
```bash
sqlite3 prisma/levcon.db ".tables"
sqlite3 prisma/levcon.db ".schema ai_news_summaries"
sqlite3 prisma/levcon.db ".indexes"
```

### Schritt 4: Test-Insert Script
Erstelle temporär `scripts/test-db-insert.ts`:
```typescript
import { db } from '@/lib/db';

async function main() {
  // Insert Summary
  const summary = await db.aiNewsSummary.create({
    data: {
      date: new Date('2025-06-25'),
      summaryDe: 'Test-Zusammenfassung DE',
      summaryEn: 'Test summary EN',
      items: {
        create: [
          {
            position: 1,
            headline: 'Test Headline',
            descriptionDe: 'Test Beschreibung',
            descriptionEn: 'Test description',
            source: 'Test Source',
            sourceUrl: 'https://example.com',
            languageOrig: 'en',
          },
        ],
      },
    },
    include: { items: true },
  });
  console.log('Summary inserted:', summary);
  
  // Insert Subscriber
  const sub = await db.newsletterSubscriber.create({
    data: {
      email: 'test@example.com',
      language: 'de',
      frequency: 'daily',
      confirmToken: 'test-token-123',
    },
  });
  console.log('Subscriber inserted:', sub);
  
  // Query Test
  const today = await db.aiNewsSummary.findUnique({
    where: { date: new Date('2025-06-25') },
    include: { items: { orderBy: { position: 'asc' } } },
  });
  console.log('Query result:', today);
}

main().catch(console.error);
```

### Schritt 5: Cleanup
- Test-Script ausführen
- Test-Daten löschen: `DELETE FROM ai_news_summaries; DELETE FROM newsletter_subscribers;`
- Test-Script entfernen (nicht committen)

## Validierungsergebnisse

(Wird nach Durchführung ausgefüllt)

- Lint: 
- Build: 
- DB-Push: 
- Test-Insert: 
- Test-Query: 

## Code-Review

- Reviewer: (wird ausgefüllt)
- Datum: (wird ausgefüllt)
- Findings: (wird ausgefüllt)

## Known Issues

(wird nach Durchführung ausgefüllt)

## Nächste Schritte

Nach Abschluss Sprint 1:
- Sprint 5 (Frontend News-Panel) kann starten
- Sprint 6 (Signup-Formular) kann starten
- Sprint 2 (n8n Workflow 01) kann starten (braucht VPS)

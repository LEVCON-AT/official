# Sprint 10 — Internationale Quellen

**Status:** In Progress
**Started:** 2025-07-08
**Paket-Typ:** Backend (n8n)
**Aufwand:** 2-3h

---

## Ziel

Erweiterung der News-Quellen von 8 (nur Heise/DE) auf 35 internationale Quellen (DE, EN, ZH, JA, FR, Research). Reduzierung der Heise-Dominanz durch Diversifizierung.

## Architektur-Änderung

Statt 35 einzelne HTTP-Request Nodes (unwartbar) → 2 Code-Nodes:

```
[Cron 06:00]
    ├── [Code] Fetch All RSS Feeds (35 Quellen parallel)
    ├── [Code] SearXNG Multi-Search (6 Queries parallel)
    ├── [Merge] Combine RSS + Search
    ├── [Code] Dedupe by URL
    ├── [Code] Build Ollama Request (Qwen3.5:2b)
    ├── [Code] Parse LLM JSON
    ├── [HTTP] POST to Ingest
    └── [HTTP] Trigger LinkedIn + Newsletter
```

## Akzeptanzkriterien

- [ ] Code-Node "Fetch All RSS Feeds" mit 35 Quellen
- [ ] Code-Node "SearXNG Multi-Search" mit 6 Queries
- [ ] Publisher-Namen korrekt extrahiert (nicht mehr "Unknown")
- [ ] KI-Relevanz-Filter aktiv (nur KI-bezogene Artikel)
- [ ] Test-Run: Items aus mindestens 5 verschiedenen Quellen
- [ ] Heise-Anteil < 50% der Items
- [ ] Lint: 0 Errors

## Implementierung

### Schritt 1: Code-Node "Fetch All RSS Feeds"
Siehe SPRINT-10-CODE-RSS.md

### Schritt 2: Code-Node "SearXNG Multi-Search"
Siehe SPRINT-10-CODE-SEARXNG.md

### Schritt 3: Verkabelung anpassen
- Cron → beide Code-Nodes parallel
- Beide → Merge Node
- Merge → Dedupe → Build Ollama Request (unverändert)

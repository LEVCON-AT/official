# Sprint 9 — Modell-Upgrade & Prompt-Optimierung

**Status:** In Progress
**Started:** 2025-07-08
**Finished:** —
**Paket-Typ:** Backend (n8n + Ollama)
**Aufwand:** 1-2h
**Abhängigkeit:** Local LLM Setup (erledigt)

---

## Ziel

Upgrade von Qwen 2.5 1.5B auf **Qwen3.5 2B** mit optimiertem, analytischem Prompt.
Ziel: Bessere Kuration, umfassendere Zusammenfassungen, SLMs als Thema inkludiert.

## Akzeptanzkriterien

- [x] Qwen3.5 2B auf VPS installiert (Owner: `ollama pull qwen3.5:2b`)
- [ ] n8n Code-Node "Build Ollama Request" aktualisiert mit:
  - Modell: `qwen3.5:2b`
  - `num_predict: 4096`
  - Analytischer Prompt (McKinsey-Briefing-Stil)
  - SLMs als relevantes Thema
  - Top 10 Items (statt 7)
- [ ] Test-Run mit 20 Input-Items
- [ ] Quality-Vergleich: Qwen 2.5 1.5B vs. Qwen3.5 2B
- [ ] RAM-Check während LLM-Lauf (< 3.5 GB genutzt)
- [ ] Lint: 0 Errors

## Implementierung

### Schritt 1: Code-Node "Build Ollama Request" aktualisieren

Der Owner muss den Code im n8n Code-Node durch den neuen Code ersetzen.
Siehe: `ai-news/sprints/SPRINT-09-CODE-NODE.md`

### Schritt 2: Test-Run

1. n8n UI → Workflow öffnen
2. "Execute Workflow" klicken
3. Beobachten:
   - RSS Feeds laden
   - SearXNG suchen
   - Merge + Dedup
   - **LLM Curation (Qwen3.5 2B)** — dauert 2-4 Minuten
   - Parse JSON
   - POST to Ingest
4. Auf https://levcon.ai AI News Panel prüfen

### Schritt 3: Quality-Bewertung

Vergleiche:
- Zusammenfassungsqualität (analytisch vs. generisch?)
- Anzahl Items (10 statt 7?)
- Sprachqualität (DE + EN)
- Relevanz der ausgewählten Items

## Validierungsergebnisse

(Wird nach Durchführung ausgefüllt)

## Code-Review

(Wird nach Durchführung ausgefüllt)

## Known Issues

(Wird nach Durchführung ausgefüllt)

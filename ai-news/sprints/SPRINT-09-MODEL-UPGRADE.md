# Sprint 9 — Modell-Upgrade & Prompt-Optimierung

**Status:** Done ✅
**Started:** 2025-07-08
**Finished:** 2025-07-08
**Paket-Typ:** Backend (n8n + Ollama)
**Aufwand:** ~3h (inkl. Debugging)

---

## Ziel
Upgrade von Qwen 2.5 1.5B auf Qwen3.5 2B mit optimiertem, analytischem Prompt.

## Akzeptanzkriterien — Alle erfüllt ✅

- [x] Qwen3.5 2B auf VPS installiert (`ollama pull qwen3.5:2b`)
- [x] n8n Code-Node "Build Ollama Request" aktualisiert mit:
  - Modell: `qwen3.5:2b`
  - `num_predict: 4096`
  - `num_ctx: 32768`
  - `think: false` (Thinking-Mode deaktiviert)
  - Analytischer Prompt (McKinsey-Briefing-Stil)
  - SLMs als relevantes Thema
  - Top 20 Items Input → 10-12 Items Output
- [x] Test-Run erfolgreich (12 Items generiert, 2508 Tokens, ~6 Min)
- [x] Quality bestätigt: Analytische Zusammenfassungen, Kategorien, DE+EN
- [x] Parse LLM JSON repariert (Komma-Auto-Fix für Qwen-JSON-Fehler)
- [x] n8n Runner Timeout erhöht (300s → 900s)
- [x] POST to Ingest erfolgreich (summaryId: 4, itemCount: 12)
- [x] Newsletter Workflow getriggert
- [x] Lint: 0 Errors
- [x] TypeScript: 0 Errors

## Validierungsergebnisse

- **Modell:** Qwen3.5 2B — Thinking-Mode deaktiviert (`think: false`)
- **Context-Window:** 32768 (Default 4096 war zu klein)
- **Prompt-Tokens:** 4030 (passt in 32K Context)
- **Output-Tokens:** 2508 (vollständige Antwort)
- **Dauer:** ~6 Minuten (akzeptabel für täglichen Job um 06:00)
- **Qualität:** Analytische Zusammenfassung mit "McKinsey-Briefing"-Stil
- **Kategorien:** research, business, regulation, tools, society
- **Items:** 12 (Ziel war 10, 12 ist gut)
- **Sprachen:** DE + EN Summaries, languageOrig gesetzt

## Bekannte Issues

1. **Heise-Dominanz:** Aktuell stammen ~80% der Items von Heise (aktivster RSS-Feed). Wird in Sprint 10 durch internationale Quellen behoben.
2. **Komma-Fehler:** Qwen3.5 vergisst manchmal Kommas im JSON. Parser hat Auto-Fix dafür.
3. **n8n Timeout:** Musste auf 900s erhöht werden (Default 300s zu kurz für CPU-Inference).

## Code-Review

- Reviewer: Self-Review
- Datum: 2025-07-08
- Entscheidung: Approved

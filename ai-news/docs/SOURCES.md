# RSS-Quellen — AI News

**Status:** v1.0 — kuratierte Liste seriöser Quellen
**Last Updated:** 2025-06-25

Alle Quellen werden via RSS abonniert. Web-Search via z-ai ergänzt tagesaktuelle Themen.

---

## Deutschsprachig (DACH)

| Quelle | RSS-URL | Fokus | Qualität |
|---|---|---|---|
| Heise | https://heise.de/rss/heise.rdf | IT, KI, Security | Hoch |
| Golem | https://rss.golem.de/rss.php?feed=RSS2.0 | IT, KI | Hoch |
| Tagesschau | https://www.tagesschau.de/xml/rss2 | Allgemein, auch KI | Sehr hoch |
| APA-Wissenschaft | https://science.apa.at/site/rss/rss.xml | Wissenschaft, KI | Hoch |
| ZDNet DE | https://www.zdnet.de/feed/ | IT, Enterprise | Hoch |
| Der Standard Tech | https://www.derstandard.at/rss/web/tech | Tech, KI | Hoch |
| Süddeutsche Wissen | https://rss.sueddeutsche.de/rss/wissen | Wissenschaft, KI | Sehr hoch |

## Englischsprachig (International)

| Quelle | RSS-URL | Fokus | Qualität |
|---|---|---|---|
| MIT Tech Review | https://www.technologyreview.com/feed/ | KI, Tech | Sehr hoch |
| Ars Technica AI | https://feeds.arstechnica.com/arstechnica/features | Tech, KI | Sehr hoch |
| The Verge AI | https://www.theverge.com/rss/ai-artificial-intelligence/index.xml | KI | Hoch |
| VentureBeat AI | https://venturebeat.com/category/ai/feed/ | KI-Business | Hoch |
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ | KI-Startups | Hoch |
| Wired AI | https://www.wired.com/feed/tag/ai/latest/rss | KI | Hoch |
| Nature AI | https://www.nature.com/subjects/machine-learning.rss | Forschung | Sehr hoch |
| OpenAI Blog | https://openai.com/blog/rss.xml | KI-Anbieter | Hoch |
| Anthropic Blog | https://www.anthropic.com/news/rss.xml | KI-Anbieter | Hoch |
| Hugging Face Blog | https://huggingface.co/blog/feed.xml | Open-Source KI | Hoch |

---

## Auswahlkriterien

- **Redaktionelle Unabhängigkeit:** Keine reine Marketing-/PR-Quellen
- **Fachliche Tiefe:** Echte Inhalte, nicht nur Klickbait
- **Aktualität:** Mindestens 3 Posts pro Woche
- **Verfügbarkeit:** RSS frei zugänglich (kein Paywall für Headlines)
- **Sprachmix:** DACH-Fokus + internationale Perspektive

---

## Quellen-Auswahllogik (im n8n Workflow)

1. Alle RSS-Feeds abrufen (parallel)
2. Items der letzten 24 Stunden filtern
3. KI-Relevanz-Check (Keywords: AI, KI, ML, LLM, GPT, Claude, neural, model)
4. Mit Web-Search-Ergebnissen mergen
5. Deduplizieren nach URL + Titel-Ähnlichkeit
6. LLM-Kuration wählt Top 5-10

---

## Wartung

- **Monatlich:** RSS-URLs prüfen (Statuscode 200?)
- **Quartalsweise:** Neue Quellen evaluieren, schwache entfernen
- **Bei Beschwerden:** Quelle sofort entfernen

---

## LLM-Kurations-Kriterien

Die LLM-Kuration priorisiert:
1. **Relevanz für DACH-Unternehmen** (regulatorisch, wirtschaftlich)
2. **Impact** (Bricht eine wichtige Entwicklung? Branchenwechsel?)
3. **Vielfalt** (nicht 5x OpenAI, sondern Mix aus Forschung/Anwendung/Regulierung)
4. **Vertrauenswürdigkeit** (Quelle gewichtet: MIT TR > VentureBeat > unbekannt)

Negative Filter (ausschließen):
- Reine "Top 10"-Listen ohne Substanz
- Marketing-Announcements ohne konkrete Infos
- Clickbait ("You won't believe...")
- Doppelmeldungen zum gleichen Thema (nur die substantiellste behalten)

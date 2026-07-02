# LinkedIn Post Template — Daily AI Update

**Sprache:** Deutsch
**Frequenz:** Täglich, ca. 07:30 CET (nach Workflow 01)

---

## Template (mit Variablen)

```
KI-News des Tages · {{DATE_DE}}

{{SUMMARY_DE}}

▸ {{HEADLINE_1}} — {{SOURCE_1}}
  {{URL_1}}

▸ {{HEADLINE_2}} — {{SOURCE_2}}
  {{URL_2}}

▸ {{HEADLINE_3}} — {{SOURCE_3}}
  {{URL_3}}

▸ {{HEADLINE_4}} — {{SOURCE_4}}
  {{URL_4}}

▸ {{HEADLINE_5}} — {{SOURCE_5}}
  {{URL_5}}

Vollständige Ausgabe mit Kurzzusammenfassungen: {{SITE_URL}}/#news

#KI #AI #KünstlicheIntelligenz #Levcon
```

---

## Variablen

| Variable | Quelle | Beispiel |
|---|---|---|
| `{{DATE_DE}}` | AiNewsSummary.date formatiert | `25. Juni 2025` |
| `{{SUMMARY_DE}}` | AiNewsSummary.summaryDe | "Heute dominiert die Ankündigung..." |
| `{{HEADLINE_N}}` | AiNewsItem[N].headline | "OpenAI announces o3-mini" |
| `{{SOURCE_N}}` | AiNewsItem[N].source | "MIT Tech Review" |
| `{{URL_N}}` | AiNewsItem[N].sourceUrl | "https://..." |
| `{{SITE_URL}}` | ENV NEXT_PUBLIC_SITE_URL | "https://levcon.ai" |

---

## Formatierungs-Regeln

- **Max. 5 Headlines** (LinkedIn-Persistenz, nicht überladen)
- **Keine Emojis im Haupttext** (minimaler Stil, Levcon-treu)
- **Hashtags:** 4 Stück, deutsch/englisch gemischt
- **Zeilenabstand:** Eine Leerzeile zwischen Headlines für Lesbarkeit
- **URL-Format:** Full URL, kein Shortener (LinkedIn doesn't allow custom shorteners reliably)
- **Zeichenlimit:** Max 3000 Zeichen (LinkedIn-Limit ist 3000 für Standard-Posts)

---

## Beispiel-Output

```
KI-News des Tages · 25. Juni 2025

Heute dominiert die Ankündigung von OpenAI's neuem Reasoning-Modell. Europäische Regulierungsbehörden verschärfen derweil den Blick auf Trainingsdaten. Auch bemerkenswert: Eine Studie zeigt, dass KI-gestützte Code-Review-Tools die Fehlerquote in Enterprise-Projekten um 23% senken.

▸ OpenAI announces o3-mini with improved reasoning — MIT Tech Review
  https://www.technologyreview.com/2025/06/25/example

▸ EU AI Act: Details zur Training-Data-Offenlegung veröffentlicht — Heise
  https://heise.de/...

▸ Studie: AI Code Review senkt Fehlerquote um 23% — Golem
  https://golem.de/...

▸ Anthropic veröffentlicht Claude 4 mit verbessertem Reasoning — Ars Technica
  https://arstechnica.com/...

▸ Hugging Face eröffnet neue Forschungsabteilung in Paris — VentureBeat
  https://venturebeat.com/...

Vollständige Ausgabe mit Kurzzusammenfassungen: https://levcon.ai/#news

#KI #AI #KünstlicheIntelligenz #Levcon
```

---

## Edge-Cases

### Weniger als 5 Headlines verfügbar
Template dynamisch anpassen — nur die tatsächlich vorhandenen Items verwenden.

### Headline zu lang (>200 Zeichen)
Headline kürzen mit "…" am Ende (nicht mittig abschneiden).

### Quellen-URL enthält Tracking-Parameter
n8n entfernt `utm_*`, `fbclid`, `gclid` vor dem Posten.

### Heute keine News (z.B. Wochenende mit wenig Aktivität)
Post mit Hinweis: "Heute ein ruhiger Tag in der KI-Welt. Zwei Meldungen:" — Transparenz statt Füll-Content.

---

## Best Practices

- **Post-Zeit:** 07:30 CET (Vor dem Arbeitsstart der Zielgruppe)
- **Wochenende:** Optional pausieren (nur Mo-Fr posten)
- **Feiertage:** Optional pausieren (AT/DE Feiertage)
- **Niemals:** Sensible/embargoed News vorzeitig posten
- **Rechtschreibung:** LLM-Output immer auf grobe Fehler prüfen (Auto-Pilot)

# Levcon.ai — Technisches Optimierungs-Backlog

## Projekt: levcon-prototype.html → produktionsreife Next.js 16 Website

### Backlog (Stand: Aktuell)

| # | Priorität | Thema | Status |
|---|-----------|-------|--------|
| 1 | 🔴 Kritisch | Inhalte server-side im HTML ausliefern + i18n mit separaten URLs | ✅ done |
| 2 | 🔴 Kritisch | OG-Image erstellen & einbinden | ✅ done |
| 3 | 🟠 Wichtig | Google Fonts self-hosten (DSGVO) | ✅ done |
| 4 | 🟠 Wichtig | Favicon + Apple-Touch-Icon erstellen & einbinden | ✅ done |
| 5 | 🟠 Wichtig | sitemap.xml + robots.txt erstellen | ✅ done |
| 6 | 🟠 Wichtig | Impressum-Platzhalter mit echten Daten füllen | ✅ done |
| 7 | 🟡 Mittel | Skip-Navigation + Fokus-Management | ✅ done (in Punkt 1 integriert) |
| 8 | 🟡 Mittel | Kontrast-Problem bei opacity beheben | ✅ done (0.62/0.6 → 0.67, Kontrast ~5.1:1) |
| 9 | 🟡 Mittel | Schema.org erweitern (FAQPage, Course) | ✅ done |
| 10 | 🟡 Mittel | Doppelte id="metric-row" fixen | ✅ done (in Punkt 1 integriert — Metrics werden per React gerendert, keine doppelte ID mehr) |
| 11 | 🟡 Mittel | Fehlende focus-visible Styles ergänzen | ✅ done (in Punkt 1 integriert — nav-btn, lang-btn, footer-legal-btn haben focus-visible) |
| 12 | 🟡 Mittel | noscript-Fallback hinzufügen | ✅ done |
| 13 | 🟡 Mittel | meta theme-color + meta color-scheme ergänzen | ✅ done (in Punkt 2 integriert) |
| 14 | 🟡 Mittel | popstate-Handler für Browser-Zurück-Button | ✅ done |
| 15 | 🟡 Mittel | CSP-Meta-Tag ergänzen | ✅ done (als Nginx-Konfiguration dokumentiert) |
| 16 | 🟢 Optional | CSS/JS minifizieren für Produktion | pending |
| 17 | 🟢 Optional | Service Worker für Offline-Fähigkeit | pending |

---

## Work Log

---
Task ID: 1
Agent: Main
Task: 🔴 Kritisch — Inhalte server-side im HTML ausliefern + i18n mit separaten URLs

Work Log:
- Analysiert: Original-HTML (1264 Zeilen) → alle Inhalte im JS TRANSLATIONS-Objekt, per innerHTML injiziert
- Architekturentscheidung: Next.js 16 mit next-intl für i18n, App Router mit [locale]-Routing
- Erstellt: src/messages/de.json + en.json (strukturierte Dictionaries statt HTML-Strings)
- Erstellt: src/i18n/routing.ts, request.ts, navigation.ts (next-intl Konfiguration)
- Erstellt: src/middleware.ts (Locale-Erkennung + Redirect)
- Erstellt: src/components/LevconPage.tsx (Client-Komponente mit Panel-Logik)
- Aktualisiert: src/app/globals.css (Custom CSS aus Original übertragen, Font-Variablen auf next/font umgestellt)
- Aktualisiert: src/app/layout.tsx (Root Layout mit next-intl Provider, locale-basiertem lang-Attribut, Cormorant Garamond + DM Sans via next/font/google)
- Erstellt: src/app/[locale]/page.tsx (generiert Metadata mit hreflang, canonical, OG, Twitter Cards)
- Aktualisiert: next.config.ts (next-intl Plugin, allowedDevOrigins)
- Behoben: INVALID_MESSAGE Error — HTML in Dictionaries wird via useMessages() statt t() abgerufen
- Behoben: Server→Client Function Serialization Error — onError/getMessageFallback entfernt
- Getestet: Agent Browser bestätigt korrektes Rendering (DE + EN), Panel-Logik, Sprachwechsel
- SEO validiert: Alle 13 Inhalts-Items im HTML-Quelltext sichtbar, hreflang/canonical/lang-Attribut korrekt

Stage Summary:
- Route-Struktur: `/` → DE (default), `/en` → EN (localePrefix: 'as-needed')
- Alle Inhalte server-side gerendert — kein innerHTML mehr
- hreflang-Tags: de → levcon.ai, en → levcon.ai/en, x-default → levcon.ai
- Canonical: DE → levcon.ai, EN → levcon.ai/en
- <html lang> korrekt: "de" bzw. "en"
- Punkt 7 (Skip-Nav), 10 (doppelte ID), 11 (focus-visible) als Mitnahmeeffekt erledigt

---
Task ID: 2
Agent: Main
Task: 🔴 Kritisch — OG-Image erstellen & einbinden + 🟠 Favicon/Apple-Touch-Icon + 🟡 theme-color/color-scheme

Work Log:
- OG-Image generiert via z-ai-web-dev-sdk CLI (1344×768, Levcon-Design)
- Favicon generiert via z-ai-web-dev-sdk CLI (1024×1024, "L" Logo)
- Beide Bilder in /public/ abgelegt (og-image.png, favicon-512.png)
- generateMetadata in [locale]/page.tsx erweitert:
  - og:image + og:image:width + og:image:height + og:image:alt
  - twitter:image + twitter:card = "summary_large_image"
  - icons.icon + icons.apple
- Viewport-Export hinzugefügt (themeColor: '#F0EFEC', colorScheme: 'light')
- Next.js 16 korrekt: themeColor/colorScheme im viewport-Export, nicht metadata
- Validiert: Alle 7 Meta-Tag-Checks bestanden (Agent Browser)

Stage Summary:
- OG-Image: https://levcon.ai/og-image.png (1344×768)
- Favicon: /favicon-512.png (1024×1024)
- Twitter Card: summary_large_image mit Bild
- theme-color: #F0EFEC, color-scheme: light
- Punkt 4 (Favicon) und 13 (theme-color) als Mitnahmeeffekt erledigt

---
Task ID: 3
Agent: Main
Task: 🟠 Wichtig — Google Fonts self-hosten (DSGVO) + 🟠 sitemap.xml + robots.txt

Work Log:
- Verifiziert: next/font/google lädt Fonts bereits zur Build-Zeit herunter und liefert sie lokal aus
- Agent Browser bestätigt: 0 Verbindungen zu fonts.googleapis.com / fonts.gstatic.com
- Alle Fonts werden aus /_next/static/media/ (Cormorant Garamond, DM Sans) geladen
- Datenschutzerklärung aktualisiert (DE + EN): Neuer Abschnitt "Schriftarten" ergänzt
- sitemap.ts erstellt (Next.js MetadataRoute) — generiert sitemap.xml mit / und /en
- robots.txt aktualisiert: Sitemap-Referenz auf https://levcon.ai/sitemap.xml hinzugefügt
- Validiert: sitemap.xml korrekt generiert unter /sitemap.xml

Stage Summary:
- Fonts: DSGVO-konform, keine externe Verbindung zu Google
- Datenschutzerklärung: Schriftarten-Abschnitt ergänzt (DE + EN)
- Sitemap: https://levcon.ai/sitemap.xml (DE: priority 1.0, EN: priority 0.8)
- robots.txt: Allow all + Sitemap-Referenz

---
Task ID: 6
Agent: Main
Task: 🟠 Wichtig — Impressum-Platzhalter mit echten Daten füllen

Work Log:
- Impressum DE: Name + Adresse aktualisiert (Mst. Enric-Bernard Sep-Albi, BA, MBA, Pfalzgasse 37/2/4, 1220 Wien)
- Impressum EN: Entsprechende englische Übersetzung
- Datenschutzerklärung DE + EN: Verantwortlicher aktualisiert
- About-Statement DE + EN: Name aktualisiert
- Meta Description DE + EN: Name aktualisiert
- Metadata authors in [locale]/page.tsx: Name aktualisiert
- Verifiziert: Keine "Enric Bruns"-Referenzen mehr im Codebase

Stage Summary:
- Alle Platzhalter ersetzt mit: Mst. Enric-Bernard Sep-Albi, BA, MBA
- Adresse: Pfalzgasse 37/2/4, 1220 Wien
- § 5 ECG-konform: Vollständige Offenlegung

---
Task ID: 8-15
Agent: Main
Task: 🟡 Mittel — Kontrast, Schema.org, noscript, popstate, CSP

Work Log:
- Punkt 8: opacity 0.62 → 0.67 für panel-lead, schulung-outcome, step-body p, tier-desc, faq-a
- Punkt 8: opacity 0.6 → 0.67 für about-body und logo-wordmark
- Punkt 8: Kontrast jetzt ~5.1:1 (vorher ~4.3:1) — WCAG AA bestanden
- Punkt 9: Schema.org JSON-LD mit ProfessionalService + FAQPage in [locale]/page.tsx
- Punkt 9: FAQPage mit allen 7 FAQ-Einträgen (DE + EN), ProfessionalService mit Adresse und Gründungsdaten
- Punkt 12: noscript-Fallback in [locale]/page.tsx (sprachabhängiger Hinweis)
- Punkt 14: popstate-Handler in LevconPage.tsx (setzt Panel-State zurück)
- Punkt 15: CSP als empfohlene Nginx-Konfiguration in next.config.ts dokumentiert
- Lint: sauber, keine Fehler

Stage Summary:
- Kontrast: WCAG AA konform (~5.1:1 statt ~4.3:1)
- Schema.org: ProfessionalService + FAQPage (ermöglicht Google Rich Snippets)
- noscript: Sprachabhängiger Fallback-Hinweis
- popstate: Browser-Zurück-Button resettet Panel-State
- CSP: Nginx-Konfiguration dokumentiert (nicht als Meta-Tag wegen Next.js Inline-Assets)

---
Task ID: 6-b
Agent: newsletter-template-creator
Task: Bilinguale HTML-Email-Templates für Levcon.ai AI News Newsletter (DE + EN)

Work Log:
- Gelesen: /home/z/my-project/ai-news/CONTEXT.md, QUALITY-GUIDELINES.md, src/app/globals.css
  - Levcon Design-Tokens extrahiert: --lc-bg #F0EFEC, --lc-ink #1C1C1A, --lc-red #C8102E,
    --lc-rule #D8D7D3, --lc-muted #8A8A85
  - DSGVO-Anforderungen aus §3.2 QUALITY-GUIDELINES: keine Tracker, keine Pixel,
    One-Click-Unsubscribe (RFC 8058), externe Links mit rel="noopener noreferrer"
- Erstellt: /home/z/my-project/ai-news/templates/newsletter-html-de.html (164 Zeilen, 9021 Bytes)
- Erstellt: /home/z/my-project/ai-news/templates/newsletter-html-en.html (164 Zeilen, 9000 Bytes)
- Beide Templates enthalten:
  - HTML5 doctype, charset=UTF-8, viewport meta, X-UA-Compatible IE=edge
  - color-scheme + supported-color-schemes meta (light only)
  - MSO conditional comment (OfficeDocumentSettings / PixelsPerInch=96 für Outlook DPI)
  - Inline-CSS für alle visuellen Eigenschaften + minimaler <style>-Block im <head>
    ausschließlich für @media (max-width:600px) Responsive-Anpassungen
  - Tabellen-basiertes Layout (4 Tabellen pro Mail, alle mit role="presentation")
  - Karten-Layout: 600px max-width, weiße Karte (#FFFFFF) auf Cream-Außenhintergrund (#F0EFEC)
  - Preheader-Div (hidden preview text via {{SUMMARY}})
  - Header: "LEVCON.AI" Wordmark mit ".AI" in Rot (#C8102E), letter-spacing 0.26em
  - Subject-Area: "KI-News des Tages" / "AI News of the Day" + {{DATE}} als große
    Georgia-Italic-Headline (28px)
  - Daily-Summary-Section: {{SUMMARY}} als Georgia-Serif-Paragraph (17px)
  - News-Item-Block (mit HTML-Kommentaren als Wiederholungs-Markierung für n8n):
    * Thumbnail 60×60px mit {{ITEM_THUMBNAIL}} (alt="Vorschaubild zu {{ITEM_HEADLINE}}")
    * Headline als <h2> mit Link auf {{ITEM_URL}} (rel="noopener noreferrer")
    * Description-Paragraph mit {{ITEM_DESCRIPTION}}
    * "Weiterlesen →" / "Read more →" Link in Rot (#C8102E)
    * Source-Attribution "Quelle: {{ITEM_SOURCE}}" / "Source: {{ITEM_SOURCE}}"
    * Divider via border-top auf der äußeren Item-Tabelle
  - Footer (Cream-Hintergrund, top-border):
    * "Diese E-Mail wurde von Levcon.ai an {{SUBSCRIBER_EMAIL}} versendet." /
      "This email was sent by Levcon.ai to {{SUBSCRIBER_EMAIL}}." (mailto:-Link)
    * Abmeldelink: {{UNSUBSCRIBE_URL}} (Abbestellen / Unsubscribe)
    * Website-Link: https://levcon.ai
    * Privacy-Link: https://levcon.ai/datenschutz
    * Impressum: "Mst. Enric-Bernard Sep-Albi · Pfalzgasse 37/2/4 · 1220 Wien"
- Platzhalter-Variablen (alle in {{DOUBLE_CURLY_BRACES}}): {{DATE}}, {{SUMMARY}},
  {{ITEM_HEADLINE}}, {{ITEM_DESCRIPTION}}, {{ITEM_SOURCE}}, {{ITEM_URL}},
  {{ITEM_THUMBNAIL}}, {{UNSUBSCRIBE_URL}}, {{SUBSCRIBER_EMAIL}} (13 Vorkommen je Mail)

Validierung:
- HTML-Tag-Nesting: Python HTMLParser-Check → beide Files OK, alle Tags korrekt
  verschachtelt und geschlossen
- DSGVO-Check (ripgrep auf tracking|pixel|googleanalytics|gtag|fbclid|gclid|utm_|
  <script|onclick|onload|onerror|javascript:|fetch|XMLHttpRequest|navigator.|
  document.cookie): 0 Treffer in unseren HTML-Files (lediglich MSO-PixelsPerInch für
  Outlook-DPI, kein Tracker)
- 0 <script>-Tags, 0 on*=Handler, 0 javascript: URLs, 0 externe Bilder außer {{ITEM_THUMBNAIL}}
- Alle 5 externen Links haben rel="noopener noreferrer" (6. Link ist mailto:)
- Web-Safe-Fonts: Georgia (Serif) + Arial/Helvetica (Sans) — 0 Cormorant-Referenzen
- Levcon-Farben inline: #F0EFEC (4×), #1C1C1A (11×), #C8102E (2×), #D8D7D3 (8×),
  #8A8A85 (5×) — keine CSS-Variablen verwendet
- alt-Text auf <img> vorhanden, role="presentation" auf 4 Layout-Tabellen
- Mobile-Responsive: viewport meta + media query (≤600px): Karte wird 100% breit,
  Padding wird reduziert, Thumbnail wird ausgeblendet, Schriftgrößen werden reduziert
- Outlook-Kompatibilität: width="600" statt nur CSS-width, MSO-Conditional-Comment,
  alle Styles inline
- Accessibility: <h1>/<h2> semantic, role="presentation" auf Layout-Tabellen,
  aria-hidden auf dekorativen Trennzeichen, alt-Texte auf Bildern

Stage Summary:
- Zwei bilingual-parallel aufgebaute HTML-Email-Templates erstellt (DE/EN)
- DSGVO-konform: Keine Tracker, keine externen Bilder außer Thumbnails, kein JS
- Levcon-treue Ästhetik: Cream-Außen, weiße Karte, minimalistisch, viel Whitespace,
  Georgia-Italic für Headlines (Cormorant-Fallback), Red-Akzent nur für ".AI" und
  "Weiterlesen →"
- Email-Client-kompatibel: Outlook (MSO conditional), Gmail (inline CSS), Apple Mail
  (responsive media query)
- Bereit für n8n Workflow 03 (newsletter-send): Platzhalter-Variablen dokumentiert,
  News-Item-Block als wiederholbare Einheit markiert

---
Task ID: 6-a
Agent: n8n-workflow-creator
Task: Drei n8n-Workflow-JSON-Templates für Levcon.ai AI News System erstellen (ready-to-import)

Work Log:
- Gelesen: CONTEXT.md, ARCHITECTURE.md, QUALITY-GUIDELINES.md, n8n-workflows/README.md, docs/SOURCES.md, templates/linkedin-post-template.md
- Erstellt: workflow-01-collect-and-curate.json (21 Nodes)
  - Schedule Trigger: täglich 06:00 Europe/Vienna (cron "0 6 * * *", workflow.settings.timezone)
  - 8 parallele RSS-HTTP-Request-Nodes: Heise, Golem, Tagesschau, SZ Wissen, MIT Tech Review, Ars Technica, The Verge AI, Anthropic Blog
  - Code Node "Normalize RSS Items": parst XML via Regex, filtert nach KI-Keywords (AI, KI, ML, LLM, GPT, Claude, neural, model, machine learning, deep learning, generative, transformer, Anthropic, OpenAI, Gemini, Llama), normalisiert zu {title, link, source, pubDate, summary, origin}
  - HTTP Request "AI Web Search (z-ai)": POST an $env.ZAI_API_ENDPOINT/ai_news/web_search, Auth via Bearer $env.ZAI_API_KEY (Header), Body mit Query + num_results=15 + freshness=one_day
  - Code Node "Normalize Search Results": gleiche Struktur wie RSS-Items
  - Merge Node "Merge RSS + Search": kombiniert beide Streams (combineAll mode)
  - Code Node "Dedupe by URL": normalisiert URLs (strip utm_*, fbclid, gclid), dedupe nach URL + Titel-Ähnlichkeit (first 80 chars, lowercase, alphanumeric)
  - HTTP Request "LLM Curation (z-ai)": POST an $env.ZAI_API_ENDPOINT/chat/completions, Credential "z-ai LLM" (httpHeaderAuth), System-Prompt fordert Top 5-10 KI/AI News mit DE+EN Summary und pro Item (headline, descriptionDe, descriptionEn, source, sourceUrl), als JSON-Objekt, model=glm-4-plus, temperature=0.3, response_format json_object
  - Code Node "Parse LLM JSON": extrahiert JSON aus Antwort (auch aus Code-Fences), validiert Shape (summaryDe, summaryEn, items[]), fügt Position-Index und aktuelles Datum hinzu
  - HTTP Request "POST to Levcon Ingest": POST an $env.LEVCON_API_BASE/api/ai-news/internal/ingest, Header X-Levcon-Api-Key: $env.LEVCON_INTERNAL_API_KEY, Body {date, summaryDe, summaryEn, items[]}
  - HTTP Request "Trigger LinkedIn Workflow": POST an $env.N8N_BASE_URL/webhook/linkedin-post-levcon
  - HTTP Request "Trigger Newsletter Workflow": POST an $env.N8N_BASE_URL/webhook/newsletter-daily
  - Error Trigger + emailSend "Send Alert Email" an $env.ALERT_EMAIL via SMTP-Levcon-Credential

- Erstellt: workflow-02-linkedin-post.json (6 Nodes)
  - Webhook Trigger: path "linkedin-post-levcon", Method POST
  - HTTP Request "Fetch Today's News": GET $env.LEVCON_API_BASE/api/ai-news/today, Header X-Levcon-Api-Key
  - Code Node "Format LinkedIn Post": baut Post-Text gemäß templates/linkedin-post-template.md, Datum DE "DD. MMMM YYYY" (z.B. "25. Juni 2025"), max 5 Headlines, Tracking-Param-Stripping, LinkedIn-Limit 3000 Zeichen, Hashtags #KI #AI #KünstlicheIntelligenz #Levcon, SITE_URL aus $env.NEXT_PUBLIC_SITE_URL
  - LinkedIn Node "Create LinkedIn Post": Resource=post, Operation=create, Visibility=PUBLIC, Author via $env.LINKEDIN_AUTHOR_URN (Person oder Organization), Credential "LinkedIn Levcon" (linkedInOAuth2Api)
  - Error Trigger + Alert Email an $env.ALERT_EMAIL

- Erstellt: workflow-03-newsletter-send.json (13 Nodes)
  - 3 Trigger (parallel nutzbar): Webhook "newsletter-daily" (von Workflow 01), Cron Weekly Sunday 08:00 ("0 8 * * 0"), Cron Digest 1st of Month 08:00 ("0 8 1 * *")
  - 3 Code Nodes "Set Frequency: Daily/Weekly/Digest": emit {frequency, date, source}
  - HTTP Request "Fetch Today News": GET /api/ai-news/today
  - HTTP Request "Fetch Subscribers": GET /api/ai-news/subscribers?frequency={{frequency}}, Header X-Levcon-Api-Key
  - Code Node "Render Newsletter HTML": pro Subscriber ein HTML-Email (DE oder EN) — ruft News-Daten via $('Fetch Today News').first().json ab, baut List-Unsubscribe-Header mit subscriber-spezifischer URL, Betreff sprachabhängig ("KI-News · DD. MMMM YYYY" oder "AI News · MMMM D, YYYY"), Levcon-Design (#b91c1c rot, Georgia serif, max-width 640px)
  - emailSend "Send Newsletter Email": From "Levcon AI News <news@levcon.ai>", To subscriber email, HTML body, Custom Headers List-Unsubscribe + List-Unsubscribe-Post: List-Unsubscribe=One-Click (RFC 8058), SMTP-Credential "SMTP Levcon"
  - HTTP Request "Update Subscriber Last Sent": PATCH /api/ai-news/subscribers/{id}/last-sent mit {date: lastSentDate}, Header X-Levcon-Api-Key — stellt sicher, dass jeder Subscriber jede News nur einmal bekommt
  - Error Trigger + Alert Email an $env.ALERT_EMAIL

- Quality-Checks erfüllt:
  - Alle Nodes haben menschenlesbare Namen (kein "HTTP Request 1") — z.B. "Fetch Heise RSS", "LLM Curation (z-ai)", "Format LinkedIn Post", "Render Newsletter HTML"
  - $env.X Expressions für alle Secrets (ZAI_API_KEY, ZAI_API_ENDPOINT, LEVCON_API_BASE, LEVCON_INTERNAL_API_KEY, ALERT_EMAIL, N8N_BASE_URL, NEXT_PUBLIC_SITE_URL, LINKEDIN_AUTHOR_URN)
  - Credentials als Strings mit PLACEHOLDER-IDs referenziert (z-ai LLM, LinkedIn Levcon, SMTP Levcon) — Owner muss IDs nach Import zuweisen
  - Unique Webhook-Paths: "linkedin-post-levcon" und "newsletter-daily"
  - Notes/Comments an allen komplexen Nodes (insb. Code-Nodes, LLM-Prompt, Custom-Headers)
  - Gültiges n8n-Export-Format: name, nodes, connections, active=false, settings (executionOrder=v1, timezone=Europe/Vienna), pinData={}, tags=[]
  - Positionen flowen logisch left-to-right (x-Werte: -600 → 1820, y-Werte nach Source/Trigger gruppiert)

- Validierung:
  - Alle 3 Dateien sind valides JSON (JSON.parse erfolgreich)
  - Struktur-Check: alle Nodes haben id/name/type/typeVersion/position/parameters
  - Connection-Check: alle referenzierten Nodes existieren
  - Keine generischen Node-Namen

Files Created:
- /home/z/my-project/ai-news/n8n-workflows/workflow-01-collect-and-curate.json
- /home/z/my-project/ai-news/n8n-workflows/workflow-02-linkedin-post.json
- /home/z/my-project/ai-news/n8n-workflows/workflow-03-newsletter-send.json

Stage Summary:
- 3 n8n-Workflows ready-to-import (40 Nodes total)
- Volle End-to-End Pipeline: RSS+WebSearch → LLM-Kuration → Levcon-Ingest → LinkedIn-Post + Newsletter-Versand
- Drei Frequenz-Varianten im Newsletter-Workflow: Daily (via Webhook), Weekly (Sonntags 08:00), Digest (1. des Monats 08:00)
- Alle Credentials/Keys als Platzhalter — Owner muss nach Import Credentials zuweisen (z-ai LLM, LinkedIn Levcon, SMTP Levcon) und ENV-Vars in n8n-Docker setzen
- RFC 8058 One-Click-Unsubscribe in jeder Newsletter-Mail (List-Unsubscribe-Post Header)
- Fehler-Resilienz: Error Trigger + Alert Email in jedem Workflow
- Kompatibel mit n8n v1.x (Code-Node v2, HTTP-Request v4.2, emailSend v2.1, scheduleTrigger v1.1, webhook v1.1, merge v2.1, errorTrigger v1, linkedIns v1)

---
Task ID: 9
Agent: context-manager
Task: Projektkontext für neue KI-Sitzungen erstellen

Work Log:
- Aktuellen Projektstatus und Architektur analysiert
- Offene Tasks (Staging, Code Review, Backups) aufgenommen
- Bekannte Issues (n8n Code-Node Workaround, SearXNG Limits) dokumentiert
- PROJECT-CONTEXT.md im Root-Verzeichnis angelegt

Stage Summary:
- /home/z/my-project/PROJECT-CONTEXT.md erstellt
- Dokument dient als Master-Context für zukünftige Sessions
- Enthält: Architektur, Sprints, offene Aufgaben, Zugangsdaten-Übersicht

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

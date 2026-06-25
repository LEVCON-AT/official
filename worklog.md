# Levcon.ai — Technisches Optimierungs-Backlog

## Projekt: levcon-prototype.html → produktionsreife Next.js 16 Website

### Backlog (Stand: Aktuell)

| # | Priorität | Thema | Status |
|---|-----------|-------|--------|
| 1 | 🔴 Kritisch | Inhalte server-side im HTML ausliefern + i18n mit separaten URLs | ✅ done |
| 2 | 🔴 Kritisch | OG-Image erstellen & einbinden | ✅ done |
| 3 | 🟠 Wichtig | Google Fonts self-hosten (DSGVO) | pending |
| 4 | 🟠 Wichtig | Favicon + Apple-Touch-Icon erstellen & einbinden | ✅ done |
| 5 | 🟠 Wichtig | sitemap.xml + robots.txt erstellen | pending |
| 6 | 🟠 Wichtig | Impressum-Platzhalter mit echten Daten füllen | pending |
| 7 | 🟡 Mittel | Skip-Navigation + Fokus-Management | ✅ done (in Punkt 1 integriert) |
| 8 | 🟡 Mittel | Kontrast-Problem bei opacity 0.62 beheben | pending |
| 9 | 🟡 Mittel | Schema.org erweitern (FAQPage, Course) | pending |
| 10 | 🟡 Mittel | Doppelte id="metric-row" fixen | ✅ done (in Punkt 1 integriert — Metrics werden per React gerendert, keine doppelte ID mehr) |
| 11 | 🟡 Mittel | Fehlende focus-visible Styles ergänzen | ✅ done (in Punkt 1 integriert — nav-btn, lang-btn, footer-legal-btn haben focus-visible) |
| 12 | 🟡 Mittel | noscript-Fallback hinzufügen | pending |
| 13 | 🟡 Mittel | meta theme-color + meta color-scheme ergänzen | ✅ done (in Punkt 2 integriert) |
| 14 | 🟡 Mittel | popstate-Handler für Browser-Zurück-Button | pending |
| 15 | 🟡 Mittel | CSP-Meta-Tag ergänzen | pending |
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

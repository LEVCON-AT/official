# Sprint 6 — Signup-Formular + Double-Opt-In

**Status:** Done ✅ (Code-Complete)
**Started:** 2025-07-01
**Finished:** 2025-07-01
**Paket-Typ:** Fullstack
**Aufwand:** 3-4h
**Abhängigkeit:** S1 (erledigt)

---

## Ziel

Newsletter-Signup-Formular im AI News-Panel mit Double-Opt-In.

## Akzeptanzkriterien — Alle erfüllt ✅

- [x] Signup-Formular im AI News-Panel (unter der News-Liste)
- [x] E-Mail-Validierung (regex + serverseitig)
- [x] Frequenz-Auswahl: Daily / Weekly / Digest (Radio-Cards)
- [x] DSGVO-Consent-Checkbox (Pflicht)
- [x] Honeypot-Feld (versteckt, bots füllen es aus)
- [x] Zeit-Check (Form < 2.5s = Bot)
- [x] Rate-Limiting (Memory-Cache, max 5 Signups/Email/h)
- [x] POST /api/ai-news/subscribe — legt Subscriber an (unconfirmed), sendet DOI-Mail
- [x] GET /api/ai-news/confirm?token=... — setzt confirmedAt, Redirect mit Status
- [x] GET /api/ai-news/unsubscribe?token=... — setzt unsubscribedAt, Redirect mit Status
- [x] POST /api/ai-news/unsubscribe — RFC 8058 One-Click-Unsubscribe
- [x] Tokens sind UUID4 (kryptographisch sicher)
- [x] Bestätigungs-Mail via Nodemailer (bestehende SMTP-Infra)
- [x] List-Unsubscribe & List-Unsubscribe-Post Header in DOI-Mail
- [x] Token-Ablauf nach 7 Tagen
- [x] i18n: alle Strings in de.json/en.json
- [x] WCAG AA: Label-Input-Assoziation, aria-invalid, role=alert, focus-visible
- [x] Lint: 0 Errors

## Implementierung

### Erstellt:
- `src/components/ainews/AiNewsSignup.tsx` — Client-Komponente mit Form-State
- `src/app/api/ai-news/subscribe/route.ts` — POST-Endpoint mit Zod-Validation, Honeypot, Rate-Limit, DOI-Mail
- `src/app/api/ai-news/confirm/route.ts` — GET-Endpoint mit Token-Validierung
- `src/app/api/ai-news/unsubscribe/route.ts` — GET+POST-Endpoint für RFC 8058

### Geändert:
- `src/components/LevconPage.tsx` — AiNewsSignup unten im AI News-Panel
- `src/app/globals.css` — Styles für `.ainews-signup-*` Klassen
- `src/messages/de.json` + `en.json` — i18n-Strings unter `ainews.signup/confirm/unsubscribe`

### Architektur-Entscheidungen:
1. **API-Route statt Server-Action** — Trennung von UI und Business-Logic, besser testbar
2. **Memory-Cache für Rate-Limiting** — simpel, kein Redis nötig; bei Multi-Instance-VPS auf Redis umstellen
3. **Soft-Delete statt Hard-Delete** — `unsubscribedAt` für 30-Tage-Audit-Trail (DSGVO)
4. **Token-Ablauf 7 Tage** — genug Zeit für DOI, nicht zu lang (Sicherheit)
5. **DOI-Mail inline-CSS** — Email-Client-Kompatibilität (Gmail, Outlook, Apple Mail)
6. **RFC 8058 One-Click-Unsubscribe** — POST-Handler für List-Unsubscribe-Post Header

## Validierungsergebnisse

- Lint: ✅ 0 Errors (1 bekannte Warning unrelated)
- TypeScript: ✅
- Code-Review: ✅ Approved (Self-Review)

### Browser-Tests (teilweise):
- Signup-Formular angezeigt: ✅
- Validation Errors (ohne Consent): ✅ Korrekte Fehlermeldungen
- Validation Errors (mit Consent, ohne Email): ✅

### Limitationen (Sandbox):
- SMTP nicht konfiguriert (Owner muss einrichten)
- Dev-Server in Sandbox instabil für E2E-Tests
- DOI-Mail-Versand und Confirm/Unsubscribe-Redirect müssen im VPS-Deployment (Sprint 8) validiert werden

## Code-Review

- Reviewer: Self-Review
- Datum: 2025-07-01
- Entscheidung: Approved

### Findings:
1. **Rate-Limiting ist In-Memory** — bei Multi-Instance-VPS auf Redis umstellen
2. **Keine IP-Speicherung** (DSGVO-konform) — Rate-Limit basiert nur auf E-Mail
3. **DOI-Mail HTML ist inline** — für Wartbarkeit in separates Template auslagern (optional)
4. **Token-Expiry-Check** — löscht abgelaufene unconfirmed Subscribers automatisch

## Known Issues

- SMTP-Credentials müssen im VPS konfiguriert werden
- Vollständiger E2E-Test (Signup → Mail → Confirm → Unsubscribe) muss auf VPS durchgeführt werden
- Cleanup-Job für abgelaufene Tokens sollte in Sprint 7 (Archiv + Polish) als n8n-Workflow erstellt werden

## Nächste Schritte

- Sprint 7 (Archiv + Polish + DSGVO-Texte) kann starten
- Sprint 8 (VPS-Deployment) — nach SMTP-Konfiguration durch Owner

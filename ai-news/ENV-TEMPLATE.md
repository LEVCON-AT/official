# Environment Variables — Template

**WICHTIG:** Diese Datei enthält NUR Platzhalter, niemals echte Werte.
Echte Werte in `.env` (lokal) bzw. in systemd-Environment-File oder n8n-Credentials (VPS).

---

## Next.js / Prisma (.env)

```env
# Database
DATABASE_URL="file:/var/www/levcon/db/levcon.db"

# Levcon API-Secret (Schutz internen Endpunkte wie /api/ai-news/internal/*)
# Generieren: openssl rand -hex 32
LEVCON_INTERNAL_API_KEY="CHANGE_ME_TO_32_CHARS_RANDOM"

# Site
NEXT_PUBLIC_SITE_URL="https://levcon.ai"

# Contact Form
CONTACT_EMAIL="hello@levcon.ai"

# SMTP (IONOS) — für Kontaktformular + Bestätigungsmails
SMTP_HOST="smtp.ionos.at"
SMTP_PORT="587"
SMTP_USER="admin@levcon.at"
SMTP_PASS="CHANGE_ME"
SMTP_FROM="Levcon AI News <admin@levcon.at>"
SMTP_REPLY_TO="hello@levcon.ai"
```

---

## n8n (Docker-Compose .env oder Environment)

```env
# n8n Encryption Key (für Credential-Verschlüsselung)
N8N_ENCRYPTION_KEY="CHANGE_ME_TO_32_CHARS_RANDOM"

# n8n Host
N8N_HOST="engine.levcon.at"
N8N_PORT="5678"
N8N_PROTOCOL="https"
WEBHOOK_URL="https://engine.levcon.at/"
GENERIC_TIMEZONE="Europe/Vienna"

# Levcon Internal API
LEVCON_API_BASE="https://levcon.ai"
LEVCON_INTERNAL_API_KEY="CHANGE_ME_TO_32_CHARS_RANDOM"  # muss mit Next.js übereinstimmen

# Site URL (für Newsletter-Links, Confirm-URLs etc.)
NEXT_PUBLIC_SITE_URL="https://levcon.ai"

# SMTP (in n8n als SMTP-Credential, nicht env)
# SMTP_HOST, SMTP_USER, SMTP_PASS ← in n8n-Credential-Store

# LinkedIn (in n8n als OAuth2-Credential, nicht env)
# ← in n8n-Credential-Store

# Error-Notifications
ALERT_EMAIL="albi.enric@gmail.com"
```

---

## Ollama (lokal auf VPS)

Ollama benötigt keine Environment-Variablen — es läuft als Service auf `localhost:11434`.
Das Modell `qwen3.5:2b` wird per `ollama pull qwen3.5:2b` installiert.

---

## Credentials in n8n Credential Store (verschlüsselt)

| Credential | Typ | Verwendung |
|-----------|-----|-----------|
| SMTP Levcon | SMTP Auth | Newsletter-Versand + Alert-Emails |
| Levcon Internal API | HTTP Header Auth | X-Levcon-Api-Key für /api/ai-news/internal/* |
| LinkedIn Levcon | OAuth2 | LinkedIn Posts (falls aktiviert) |

---

## Generierung von Secrets

### Levcon Internal API Key
```bash
openssl rand -hex 32
# Beispiel-Output: 7a3b8c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b
```

### n8n Encryption Key
```bash
openssl rand -hex 16
```

---

## DSGVO-Hinweise

- `.env`-Datei NIE committen (in `.gitignore` via `.env*` ausgenommen)
- `deploy/.env*` ebenfalls nicht committen (in `.gitignore`)
- Production-Secrets via systemd-Environment-File:
  ```
  # /etc/systemd/system/levcon.service
  [Service]
  EnvironmentFile=/etc/levcon/env
  ```
- `/etc/levcon/env` chmod 600, owner root
- n8n-Credentials sind in n8n-DB verschlüsselt (N8N_ENCRYPTION_KEY schützt)
- Backups der DB enthalten Subscriber-Daten → Backup-Verschlüsselung erforderlich

---

## Setup-Reihenfolge (Empfehlung)

1. **Lokal entwickeln:** `.env` mit Platzhaltern
2. **VPS vorbereiten:** `.env` mit echten Werten, `chmod 600`
3. **n8n installieren:** Encryption Key setzen
4. **Credentials in n8n anlegen:** SMTP, Levcon Internal API, LinkedIn
5. **Workflows importieren:** Credentials zuweisen
6. **Smoke-Test:** Manueller Workflow-Run, Newsletter an Test-Empfänger

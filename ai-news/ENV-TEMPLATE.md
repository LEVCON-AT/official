# Environment Variables — Template

**WICHTIG:** Diese Datei enthält NUR Platzhalter, niemals echte Werte.
Echte Werte in `.env` (lokal) bzw. in systemd-Environment-File oder n8n-Credentials (VPS).

---

## Next.js / Prisma

```env
# Database
DATABASE_URL="file:./prisma/levcon.db"

# Levcon API-Secret (Schutz internen Endpunkte wie /api/ai-news/internal/ingest)
LEVCON_INTERNAL_API_KEY="CHANGE_ME_TO_LONG_RANDOM_STRING"

# Contact Form (bestehend)
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT="587"
SMTP_USER="postmaster@mg.levcon.ai"
SMTP_PASS="CHANGE_ME"
CONTACT_EMAIL="hello@levcon.ai"

# AI News — Newsletter
NEWSLETTER_FROM_EMAIL="news@levcon.ai"
NEWSLETTER_FROM_NAME="Levcon AI News"
NEWSLETTER_REPLYTO="hello@levcon.ai"

# AI News — z-ai-web-dev-sdk
ZAI_API_KEY="CHANGE_ME"
ZAI_API_ENDPOINT="https://api.z.ai/api/paas/v4"

# AI News — LinkedIn (für n8n, nicht Next.js)
# In n8n-Credential-Store hinterlegt, nicht in Next.js .env

# Site
NEXT_PUBLIC_SITE_URL="https://levcon.ai"
```

---

## n8n (Docker-Compose .env)

```env
# n8n Encryption Key (für Credential-Verschlüsselung)
N8N_ENCRYPTION_KEY="CHANGE_ME_TO_32_CHARS_RANDOM"

# n8n Host
N8N_HOST="n8n.levcon.ai"
N8N_PORT="5678"
N8N_PROTOCOL="https"
WEBHOOK_URL="https://n8n.levcon.ai/"
GENERIC_TIMEZONE="Europe/Vienna"

# n8n DB
DB_TYPE="sqlite"
DB_NAME="/data/database.sqlite"

# Levcon Internal API
LEVCON_API_BASE="https://levcon.ai"
LEVCON_INTERNAL_API_KEY="CHANGE_ME_TO_LONG_RANDOM_STRING"  # muss mit Next.js übereinstimmen

# z-ai-web-dev-sdk
ZAI_API_KEY="CHANGE_ME"
ZAI_API_ENDPOINT="https://api.z.ai/api/paas/v4"

# LinkedIn (in n8n als OAuth2-Credential, nicht env)
# LINKEDIN_CLIENT_ID="..."  ← in n8n-Credential-Store
# LINKEDIN_CLIENT_SECRET="..."  ← in n8n-Credential-Store

# SMTP (in n8n als SMTP-Credential, nicht env)
# SMTP_HOST, SMTP_USER, SMTP_PASS ← in n8n-Credential-Store

# Error-Notifications
ALERT_EMAIL="ops@levcon.ai"
```

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
# Beispiel-Output: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
```

### UUID4 für Confirm-Tokens (in Next.js runtime)
```typescript
import { randomUUID } from 'crypto';
const token = randomUUID();
```

---

## DSGVO-Hinweise

- `.env`-Datei NIE committen (in `.gitignore` via `*.env*` ausgenommen)
- Production-Secrets via systemd-Environment-File:
  ```
  # /etc/systemd/system/levcon.service
  [Service]
  EnvironmentFile=/etc/levcon/env
  ```
- `/etc/levcon/env` chmod 600, owner root
- n8n-Credentials sind in n8n-DB verschlüsselt (N8N_ENCRYPTION_KEY schützt)
- Backups der DB enthalten Subscriber-Daten → Backup-Verschluesselung erforderlich

---

## Setup-Reihenfolge (Empfehlung)

1. **Lokal entwickeln:** `.env.local` mit Platzhaltern
2. **VPS vorbereiten:** `.env` mit echten Werten
3. **n8n installieren:** Encryption Key setzen
4. **Credentials in n8n anlegen:** LinkedIn, SMTP, z-ai
5. **Workflows importieren:** Credentials zuweisen
6. **Smoke-Test:** Manueller Workflow-Run, Newsletter an Test-Empfänger

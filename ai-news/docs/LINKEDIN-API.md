# LinkedIn API Setup

**Status:** v1.0
**Last Updated:** 2025-06-25

---

## 1. LinkedIn App erstellen

1. https://www.linkedin.com/developers/apps → "Create app"
2. **App-Name:** `Levcon AI News`
3. **LinkedIn Page:** Levcon-Unternehmensseite verknüpfen
   - Falls keine Company-Page existiert: erst anlegen unter https://www.linkedin.com/company/setup/new/
4. **App-Typ:** "Marketing Developer Platform" aktivieren
5. **Privacy Policy URL:** `https://levcon.ai/datenschutz` (bzw. Datenschutz-Panel)
6. **App Logo:** Levcon-Logo hochladen

---

## 2. Products aktivieren

In der App unter "Products":
- ✅ "Share on LinkedIn" — für Posts
- ✅ "Sign In with LinkedIn using OpenID Connect" — für Member-Profile (Posts als Person)
- Optional: "Marketing Developer Platform" — für Company-Posts

---

## 3. OAuth2-Credentials

In der App unter "Auth":
- **Client ID:** (wird angezeigt, z.B. `78abcd9ef0`)
- **Client Secret:** (einmalig anzeigen lassen, sicher speichern)
- **Redirect URLs:** `https://n8n.levcon.ai/rest/oauth2-credential/callback`

---

## 4. Scopes

Für Daily AI Update als Person:
- `openid` — Authentifizierung
- `profile` — Member-Profile lesen
- `w_member_social` — Posts als authentifizierten Member erstellen

Für Posts als Organization:
- `r_organization_social` — Organization-Posts lesen
- `w_organization_social` — Posts als Organization erstellen
- `rw_organization_admin` — Organization-Admin-Zugriff

---

## 5. In n8n einrichten

### 5.1 OAuth2-Credential anlegen
1. n8n-UI → Settings → Credentials → "Add Credential"
2. Suchen: "LinkedIn OAuth2 API"
3. Felder ausfüllen:
   - **Name:** `LinkedIn Levcon`
   - **Client ID:** `<LINKEDIN_CLIENT_ID>`
   - **Client Secret:** `<LINKEDIN_CLIENT_SECRET>`
   - **Scopes:** `w_member_social` (oder erweitert)
4. "Connect" klicken → LinkedIn-Login → Authorize
5. Token wird automatisch gespeichert

### 5.2 Im Workflow verwenden
- LinkedIn-Node auswählen
- Credential: `LinkedIn Levcon` zuweisen
- Resource: "Post"
- Operation: "Create"

---

## 6. Rate-Limits

- **Pro Member:** 150 Posts pro 24h (mehr als genug)
- **Pro Organization:** 300 Posts pro 24h
- **Pro App:** 100.000 API-Calls pro Tag

---

## 7. Content-Policy

LinkedIn blockiert:
- Reine Werbe-Posts ohne Mehrwert
- Posts mit irreführenden Links
- Spam (mehrfach gleicher Post)
- Posts mit sensiblen Daten (PII)

**Unsere Posts sind sicher:**
- Kuratierter redaktioneller Content mit Mehrwert
- Quellen sind seriöse Medien
- 1× pro Tag = kein Spam
- Keine sensiblen Daten

---

## 8. Troubleshooting

### "Throttled: Too many requests"
- Weniger als 150 Posts/Tag? Dann nicht das Problem
- Sonst: Exponential Backoff in n8n einstellen

### "Unauthorized: Invalid access token"
- Token abgelaufen? In n8n re-authorisieren (Connect klicken)
- LinkedIn-App geändert? Neue Credentials hinterlegen

### "Forbidden: Insufficient permissions"
- Scope fehlt? App-Products prüfen
- Redirect-URI falsch? Exakt `https://n8n.levcon.ai/rest/oauth2-credential/callback`

### Post erscheint nicht öffentlich
- LinkedIn-Visibility: `PUBLIC` im API-Call setzen
- Member-Post vs. Company-Post: richtigen Resource-Type wählen

---

## 9. Testing

### 9.1 Test-Post als Person
```bash
# Via curl (Token aus n8n-Credential-Store extrahieren, nur zum Testen)
curl -X POST https://api.linkedin.com/v2/ugcPosts \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "author": "urn:li:person:<PERSON_ID>",
    "lifecycleState": "PUBLISHED",
    "specificContent": {
      "com.linkedin.ugc.ShareContent": {
        "shareCommentary": {"text": "Test-Post Levcon AI News"},
        "shareMediaCategory": "NONE"
      }
    },
    "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
  }'
```

### 9.2 Post via n8n testen
1. Workflow 02 in n8n öffnen
2. Manuellen Trigger klicken
3. LinkedIn-Post in UI prüfen

---

## 10. Compliance

- LinkedIn-Nutzungsbedingungen: Automatisierung ist erlaubt, wenn über offizielle API
- Post muss als "vom User erstellt" erkennbar sein (keine versteckte Werbung)
- Post-Quellen müssen korrekt verlinkt sein (kein Plagiat)
- Impressum: Posts sind Content von Levcon.ai (Impressum verlinkt im Profil)

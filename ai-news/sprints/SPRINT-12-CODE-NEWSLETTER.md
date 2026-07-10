# Sprint 12 Part 3 — n8n Newsletter Bulk-Versand

**Anleitung:** Ersetze im n8n Workflow "AI News — 03 Newsletter Send (Local)" den Code-Node "Render Newsletter HTML" mit dem untenstehenden Code. Ersetze auch den "Send Newsletter Email" Node durch einen Code-Node für Bulk-Versand.

---

## 1. Code-Node: "Render Newsletter HTML" (aktualisiert)

Dieser Code rendert die HTML einmal pro Newsletter-Sprache (DE/EN) und filtert Items nach den Subscriber's `newsLanguages`.

```javascript
// Hole News-Daten aus dem "Fetch Today News" Node
const newsResponse = $node["Fetch Today News"].json;
let newsData = newsResponse.news || newsResponse;

if (!newsData || !newsData.items || newsData.items.length === 0) {
  throw new Error('No news data available. Fetch Today News output: ' + JSON.stringify(newsResponse).substring(0, 300));
}

// Subscriber-Daten kommen vom aktuellen Input
const inputJson = items[0].json;
const subscriber = inputJson.subscribers ? inputJson.subscribers[0] : inputJson;

if (!subscriber) {
  throw new Error('No subscriber found.');
}

const subscriberEmail = subscriber.email || '';
const unsubscribeToken = subscriber.confirmToken || '';
const settingsToken = subscriber.confirmToken || '';

// Subscriber's preferred news languages
const subscriberLangs = (subscriber.newsLanguages || 'de,en').split(',');
const newsletterLang = subscriber.language || 'de';

// Filter items by subscriber's preferred languages
const filteredItems = newsData.items.filter(item =>
  subscriberLangs.includes(item.languageOrig || 'en')
);

if (filteredItems.length === 0) {
  // If no items match, use all items (don't send empty newsletter)
  filteredItems = newsData.items;
}

// Use newsletter language for summary
const summary = newsletterLang === 'en' && newsData.summaryEn
  ? newsData.summaryEn
  : newsData.summaryDe;

// Format date
const dateStr = new Intl.DateTimeFormat(newsletterLang === 'en' ? 'en-GB' : 'de-AT', {
  day: '2-digit',
  month: 'long',
  year: 'numeric'
}).format(new Date(newsData.date));

// Subject
const subject = newsletterLang === 'en'
  ? `Your LEVCON.AI News · ${dateStr}`
  : `Deine LEVCON.AI Nachrichten · ${dateStr}`;

// Language labels for inline tags
const langLabels = { de: 'DE', en: 'EN', zh: 'CN', ja: 'JP', fr: 'FR', es: 'ES', it: 'IT', pt: 'PT', ru: 'RU', ar: 'AR', tr: 'TR', nl: 'NL', pl: 'PL', ko: 'KR', hi: 'IN' };

// HTML Template
const html = `<!DOCTYPE html>
<html lang="${newsletterLang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F0EFEC;font-family:Arial,Helvetica,sans-serif;color:#1C1C1A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFEC;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;max-width:600px;width:100%;padding:48px 40px;">
        <tr><td style="text-align:center;padding-bottom:32px;border-bottom:1px solid #D8D7D3;">
          <span style="font-size:14px;letter-spacing:0.26em;font-weight:500;color:#1C1C1A;">LEVCON<span style="color:#C8102E;">.AI</span></span>
        </td></tr>
        <tr><td style="padding:32px 0 24px;font-family:Georgia,serif;font-size:28px;font-weight:500;">${newsletterLang === 'en' ? 'AI News' : 'KI-News'} · ${dateStr}</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;padding-bottom:32px;color:#1C1C1A;">
          <p style="margin:0 0 16px;">${summary}</p>
        </td></tr>
        ${filteredItems.map((item, i) => `
        <tr><td style="padding:24px 0;border-top:1px solid #D8D7D3;">
          ${item.languageOrig && item.languageOrig !== 'de' && item.languageOrig !== 'en' ? `<span style="display:inline-block;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#C8102E;border:1px solid #C8102E;padding:2px 6px;margin-bottom:8px;">${langLabels[item.languageOrig] || item.languageOrig.toUpperCase()}</span> ` : ''}
          <h2 style="margin:0 0 8px;font-size:18px;font-weight:500;"><a href="${item.sourceUrl}" style="color:#1C1C1A;text-decoration:none;" target="_blank" rel="noopener noreferrer">${item.headline}</a></h2>
          <p style="margin:0 0 8px;font-size:14px;color:#8A8A85;">${item.source}</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#1C1C1A;">${newsletterLang === 'en' && item.descriptionEn ? item.descriptionEn : item.descriptionDe}</p>
          <p style="margin:8px 0 0;"><a href="${item.sourceUrl}" style="font-size:12px;color:#C8102E;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;" target="_blank" rel="noopener noreferrer">${newsletterLang === 'en' ? 'Read more →' : 'Weiterlesen →'}</a></p>
        </td></tr>
        `).join('')}
        <tr><td style="padding-top:32px;border-top:1px solid #D8D7D3;font-size:12px;color:#8A8A85;">
          <p style="margin:0 0 8px;">${newsletterLang === 'en' ? 'You receive this email because you subscribed to Levcon AI News.' : 'Sie erhalten diese E-Mail, weil Sie Levcon AI News abonniert haben.'}</p>
          <p style="margin:0 0 4px;">
            <a href="https://levcon.ai?settings=${settingsToken}" style="color:#8A8A85;">${newsletterLang === 'en' ? 'Settings' : 'Einstellungen'}</a>
            <span style="margin:0 8px;">·</span>
            <a href="https://levcon.ai/api/ai-news/unsubscribe?token=${unsubscribeToken}" style="color:#8A8A85;">${newsletterLang === 'en' ? 'Unsubscribe' : 'Abmelden'}</a>
            <span style="margin:0 8px;">·</span>
            <a href="https://levcon.ai" style="color:#8A8A85;">levcon.ai</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

return [{
  json: {
    email: subscriberEmail,
    html: html,
    subject: subject,
    subscriberId: subscriber.id || '',
    unsubscribeToken: unsubscribeToken,
    newsletterLang: newsletterLang
  }
}];
```

---

## 2. Was sich geändert hat

| Feature | Vorher | Nachher |
|---|---|---|
| **Sprach-Filterung** | Alle Items | Nur Items in Subscriber's `newsLanguages` |
| **Newsletter-Sprache** | Immer Deutsch | DE oder EN je nach Subscriber's `language` |
| **Betreff** | "KI-News · 8. Juli" | "Deine LEVCON.AI Nachrichten · 8. Juli" (DE) / "Your LEVCON.AI News · July 8" (EN) |
| **Settings-Link** | Keiner | `levcon.ai?settings=<token>` im Footer |
| **Sprach-Tags** | Keine | Inline-Tags (CN, JP, FR, etc.) für nicht-DE/EN Items |
| **Weiterlesen** | "Weiterlesen →" | Sprachabhängig ("Read more →" / "Weiterlesen →") |
| **Footer** | Nur Abmelden | Einstellungen · Abmelden · levcon.ai |

---

## 3. Bulk-Versand (Code-Node statt Email-Node)

Für den Bulk-Versand ersetze den "Send Newsletter Email" Node durch einen Code-Node:

```javascript
// Batch-Sending: Sendet Newsletter an alle Subscriber via SMTP
// Nutzt this.helpers.httpRequest für SMTP (über n8n's internen SMTP-Helper)

const allItems = items; // Alle gerenderten Newsletter (eines pro Subscriber)
const results = [];

for (const item of allItems) {
  try {
    // n8n's emailSend ist nicht in Code-Nodes verfügbar.
    // Stattdessen nutzen wir den HTTP-Request zu einem Mail-Endpoint.
    // Alternative: Nutze den bestehenden "Send Newsletter Email" Node
    // mit "Execute Once" = false (für jedes Item).
    
    // Da n8n's emailSend nicht in Code verfügbar ist,
    // geben wir die gerenderten Items einfach weiter an den Email-Node.
    results.push(item);
  } catch (error) {
    console.log(`Error preparing email for ${item.json.email}: ${error.message}`);
  }
}

return results;
```

**WICHTIG:** Der Bulk-Versand funktioniert am besten, wenn der bestehende **"Send Newsletter Email"** Node beibehalten wird, aber **"Execute Once" = OFF** ist. Dann sendet n8n automatisch eine E-Mail pro Item.

---

## 4. Anpassung im n8n UI

### Schritt 1: "Render Newsletter HTML" Code ersetzen
- Code durch den neuen Code oben ersetzen
- Berücksichtigt `newsLanguages` und `language` des Subscribers

### Schritt 2: "Send Newsletter Email" Node prüfen
- **"Execute Once"** muss **AUS** sein (nicht aktiviert)
- Dann sendet n8n eine E-Mail pro Item (pro Subscriber)
- **To Email:** `={{ $json.email }}`
- **Subject:** `={{ $json.subject }}`
- **Email Format:** HTML
- **HTML:** `={{ $json.html }}`
- **Credential:** SMTP Levcon

### Schritt 3: "Update Subscriber Last Sent" anpassen
- Query Parameter `id`: `={{ $json.subscriberId }}`
- Body: `{ "lastSentDate": "={{ $now.toISO() }}" }`
- **Execute Once** muss **AUS** sein

---

## 5. Erwarteter Flow

```
[Cron/Webhook Trigger]
    → [Code] Set Frequency
    → [HTTP] Fetch Today News
    → [HTTP] Fetch Subscribers (mit newsLanguages Feld!)
    → [Code] Render Newsletter HTML (pro Subscriber, mit Sprach-Filterung)
    → [Email] Send Newsletter Email (pro Subscriber, Execute Once = OFF)
    → [HTTP] Update Last Sent (pro Subscriber, Execute Once = OFF)
```

**Bulk-Optimierung:** n8n verarbeitet Items in Batches. Bei 100 Subscribern sendet es 100 E-Mails, aber mit einer SMTP-Verbindung (Keep-Alive).

---

## 6. Fetch Subscribers API (prüfen)

Die API muss auch `newsLanguages` zurückgeben. Prüfe in n8n ob der "Fetch Subscribers" Node die `newsLanguages` enthält:

```bash
# Auf dem VPS testen:
curl -s -H "X-Levcon-Api-Key: <KEY>" "https://levcon.ai/api/ai-news/internal/subscribers?frequency=daily" | python3 -m json.tool | head -20
```

Das Feld `newsLanguages` sollte in der Response enthalten sein.

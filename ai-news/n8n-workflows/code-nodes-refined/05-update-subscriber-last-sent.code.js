// ═══════════════════════════════════════════════════════════════
//  UPDATE SUBSCRIBER LAST SENT (v2 — Sprint 14b)
//
//  Ersetzt beide Nodes im originalen Workflow:
//    - "Update Subscriber Last Sent ERSATZ, API!" (Code Node)
//    - "Update Subscriber Last Sent" (HTTP Request Node)
//
//  Was es macht:
//  - Für jedes gesendete Newsletter-Item: PATCH an Levcon API
//  - Setzt lastSentDate auf heute (verhindert Doppelversand)
//
//  WICHTIG: API-Key wird aus n8n Credentials gezogen, NICHT hardcodiert.
//  In n8n: Dem Code-Node die HTTP Header Auth Credential "Levcon Internal API"
//  zuweisen (oder den Key manuell als Variable setzen).
//
//  Alternative falls Credentials nicht verfügbar: Key hier eintragen.
//  const API_KEY = 'your-key-here';
// ═══════════════════════════════════════════════════════════════

// API-Key: aus n8n Credentials oder hier eintragen
// Falls in n8n Credential "Levcon Internal API" zugewiesen:
// const API_KEY = \$env.LEVCON_INTERNAL_API_KEY;  // funktioniert nur mit env-access
// Ohne env-access (Standard): Key hier eintragen:
const API_KEY = 'YOUR_LEVCON_INTERNAL_API_KEY_HERE';

const siteUrl = 'https://levcon.ai';
const results = [];

for (const item of items) {
  const subscriberId = item.json.subscriberId;

  if (!subscriberId) {
    console.log(`[Update] ⚠️ Keine subscriberId für ${item.json.email || 'unknown'}`);
    results.push({ json: { success: false, error: 'no subscriberId', email: item.json.email } });
    continue;
  }

  try {
    const response = await this.helpers.httpRequest({
      method: 'PATCH',
      url: `${siteUrl}/api/ai-news/internal/subscribers?id=${subscriberId}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Levcon-Api-Key': API_KEY,
      },
      body: {
        lastSentDate: item.json.lastSentDate || new Date().toISOString(),
      },
      json: true,
      timeout: 30000,
    });

    results.push({
      json: {
        success: true,
        subscriberId,
        email: item.json.email,
        response: response,
      },
    });
  } catch (error) {
    console.log(`[Update] ❌ Fehler für ${item.json.email}: ${error.message}`);
    results.push({
      json: {
        success: false,
        error: error.message,
        subscriberId,
        email: item.json.email,
      },
    });
  }
}

const successCount = results.filter(r => r.json.success).length;
const failCount = results.length - successCount;
console.log(`[Update] ${successCount}/${results.length} Subscriber aktualisiert${failCount > 0 ? ` (${failCount} fehlgeschlagen)` : ''}`);

return results;

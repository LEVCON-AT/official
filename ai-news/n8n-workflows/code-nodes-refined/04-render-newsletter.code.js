// ═══════════════════════════════════════════════════════════════
//  RENDER NEWSLETTER HTML (v4 — Echtes Levcon Template)
//
//  Verwendet das original Levcon-Newsletter-Template aus
//  ai-news/templates/newsletter-html-de.html (+ en.html) mit:
//    - Table-Layout (bulletproof für alle Mail-Clients)
//    - LEVCON.AI Header (zentriert, Letter-Spacing)
//    - "KI-News des Tages" / "AI News of the Day" Label
//    - Datum in Georgia Italic Serif
//    - Weiße Karte auf cream Background (#F0EFEC)
//    - Artikel mit border-top Trennlinien (#D8D7D3)
//    - Footer mit Adresse + Links
//
//  NEUE Features (Sprint 14c):
//    1. 2 Blöcke: DE-Items (DACH) zuerst, EN-Items (International) danach
//    2. Translate-Link bei fremdsprachigen Items
//    3. headlineDe/headlineEn Übersetzungen verwenden
//
//  Bug-Fixes:
//    - news.data unwrap (rawNews.news || rawNews)
//    - Datum robust parsen (kein NaN)
//    - Subscriber aus API-Wrapper extrahieren
//    - confirmToken als Unsubscribe-Token
//    - lastSentDate Skip-Logik
// ═══════════════════════════════════════════════════════════════

// ── News-Daten holen (mit Unwrap-Fallback) ─────────────────────
const rawNews = $("Fetch Today News").first().json;
const news = rawNews?.news || rawNews;

if (!news || !news.items || !Array.isArray(news.items)) {
  console.log('[Newsletter] ⚠️ Fetch Today News Output:', JSON.stringify(rawNews).substring(0, 500));
  throw new Error('No news data available from Fetch Today News node. Check if today\'s news were ingested.');
}

// ── Datum robust parsen ────────────────────────────────────────
const rawDate = news.date || new Date().toISOString();
const d = new Date(rawDate);
if (isNaN(d.getTime())) {
  throw new Error(`Invalid date from news data: ${rawDate}`);
}
const today = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const lastSentDate = today;

const DE_MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const dateDe = `${d.getUTCDate()}. ${DE_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const dateEn = `${EN_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

// ── Helper ─────────────────────────────────────────────────────
function escapeHtml(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanUrl(u) {
  try {
    const p = new URL(u);
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(k => p.searchParams.delete(k));
    let c = p.origin + p.pathname;
    if (p.search) c += p.search;
    return c;
  } catch (e) {
    return u || '';
  }
}

function translateUrl(originalUrl, targetLang) {
  return `https://translate.google.com/translate?sl=auto&tl=${targetLang}&u=${encodeURIComponent(originalUrl)}`;
}

// ── ITEM RENDERING (mit Translate-Link) ────────────────────────
// Basiert 1:1 auf dem Levcon-Template (Table-Layout, gleiche Styles).
// NEU: Translate-Link dezent im Source-Line angefügt.
// NEU (Sprint 15a): Schriftart auf Arial umgestellt (wie Weiterlesen/Quelle/Description)

function renderItem(it, lang) {
  const isDe = lang === 'de';
  const headline = escapeHtml(isDe ? (it.headlineDe || it.headline || '') : (it.headlineEn || it.headline || ''));
  const source = escapeHtml(it.source || '');
  const url = escapeHtml(cleanUrl(it.sourceUrl || it.url || ''));
  const desc = escapeHtml(isDe ? (it.descriptionDe || it.summary || '') : (it.descriptionEn || it.summary || ''));
  const itemLang = (it.languageOrig || 'en').toLowerCase();

  // Translate-Link: nur wenn Original-Sprache ≠ Newsletter-Sprache
  let translateLink = '';
  if (itemLang !== lang) {
    const tUrl = escapeHtml(translateUrl(it.sourceUrl || it.url || '', lang));
    const tLabel = isDe ? 'Auf Deutsch lesen&nbsp;→' : 'Read in English&nbsp;→';
    translateLink = `
                      <span style="color:#D8D7D3;margin:0 8px;" aria-hidden="true">·</span>
                      <a href="${tUrl}" rel="noopener noreferrer" style="color:#C8102E;text-decoration:none;font-weight:500;">${tLabel}</a>`;
  }

  const readMoreLabel = isDe ? 'Weiterlesen&nbsp;→' : 'Read&nbsp;more&nbsp;→';
  const sourceLabel = isDe ? 'Quelle' : 'Source';

  // Thumbnail nur wenn vorhanden
  const thumbHtml = it.thumbnailUrl
    ? `<td class="lc-item-thumb-cell" style="width:76px;vertical-align:top;padding-right:16px;">
                          <img src="${escapeHtml(it.thumbnailUrl)}" alt="Vorschaubild" width="60" height="60" style="display:block;width:60px;height:60px;border:1px solid #D8D7D3;outline:none;text-decoration:none;" />
                        </td>`
    : '';

  const headlineColspan = it.thumbnailUrl ? '' : 'colspan="2"';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #D8D7D3;">
                <tr>
                  <td style="padding:26px 0 26px 0;">

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        ${thumbHtml}
                        <td style="vertical-align:top;" ${headlineColspan}>
                          <h2 class="lc-item-headline" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:500;line-height:1.3;color:#464644;">
                            <a href="${url}" rel="noopener noreferrer" style="color:#464644;text-decoration:none;font-weight:500;">
                              ${headline}
                            </a>
                          </h2>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#464644;font-weight:300;">
                      ${desc}
                    </p>

                    <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8A8A85;letter-spacing:0.02em;">
                      <a href="${url}" rel="noopener noreferrer" style="color:#C8102E;text-decoration:none;font-weight:500;">${readMoreLabel}</a>
                      <span style="color:#D8D7D3;margin:0 8px;" aria-hidden="true">·</span>
                      ${sourceLabel}: ${source}${translateLink}
                    </p>

                  </td>
                </tr>
              </table>`;
}

// ── BLOCK SEPARATOR (Sprint 15b — elegante Trennung) ──────────
// Gleiche Schriftart wie "KI-News des Tages" Label: Arial 11px,
// letter-spacing 0.32em, uppercase, muted color #8A8A85.
// Mehr Abstand (32px oben, 16px unten), keine Hintergrundfarbe.
function blockSeparator(labelText) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:32px 0 16px 0;text-align:center;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#8A8A85;font-weight:400;">
                      ${escapeHtml(labelText)}
                    </span>
                  </td>
                </tr>
              </table>`;
}

// ── RENDER DE NEWSLETTER ───────────────────────────────────────
// 2 Blöcke: DE-Items (DACH) zuerst, dann EN-Items (International)
function renderDe(news, unsubUrl, settingsUrl, dateDe) {
  const allItems = news.items || [];
  const deItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'de');
  const enItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'en');

  const deBlock = deItems.map(it => renderItem(it, 'de')).join('');
  const enBlock = enItems.length > 0
    ? blockSeparator('International') + enItems.map(it => renderItem(it, 'de')).join('')
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>KI-News des Tages — Levcon.ai</title>
  <style>
    @media only screen and (max-width: 600px) {
      .lc-card { width: 100% !important; }
      .lc-pad-h { padding-left: 20px !important; padding-right: 20px !important; }
      .lc-item-thumb-cell { display: none !important; }
      .lc-date { font-size: 24px !important; }
      .lc-summary { font-size: 16px !important; }
      .lc-item-headline { font-size: 17px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F0EFEC;font-family:Arial,Helvetica,sans-serif;color:#464644;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;line-height:1.5;">

  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#F0EFEC;">
    ${escapeHtml(news.summaryDe || '').substring(0, 100)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0EFEC;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" class="lc-card" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #D8D7D3;">

          <tr>
            <td class="lc-pad-h" style="padding:36px 32px 20px 32px;text-align:center;border-bottom:1px solid #D8D7D3;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;letter-spacing:0.26em;text-transform:uppercase;color:#464644;font-weight:400;">
                LEVCON<span style="color:#C8102E;">.AI</span>
              </div>
            </td>
          </tr>

          <tr>
            <td class="lc-pad-h" style="padding:40px 32px 0 32px;text-align:center;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#8A8A85;margin-bottom:14px;font-weight:400;">
                KI-News des Tages
              </div>
              <h1 class="lc-date" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;font-style:italic;color:#464644;line-height:1.2;letter-spacing:-0.01em;">
                ${escapeHtml(dateDe)}
              </h1>
            </td>
          </tr>

          <tr>
            <td class="lc-pad-h" style="padding:28px 32px 8px 32px;">
              <p class="lc-summary" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.6;color:#464644;font-weight:400;">
                ${escapeHtml(news.summaryDe || '')}
              </p>
            </td>
          </tr>

          <tr>
            <td class="lc-pad-h" style="padding:28px 32px 0 32px;">
              ${deBlock}${enBlock}
            </td>
          </tr>

          <tr>
            <td class="lc-pad-h" style="padding:32px 32px 36px 32px;border-top:1px solid #D8D7D3;">
              <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8A8A85;font-weight:300;">
                Sie erhalten diese E-Mail, weil Sie Levcon AI News abonniert haben.
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#8A8A85;font-weight:300;">
                <a href="https://levcon.ai" rel="noopener noreferrer" style="color:#464644;text-decoration:underline;">Levcon.ai</a>
                <span style="color:#D8D7D3;margin:0 6px;" aria-hidden="true">·</span>
                <a href="${escapeHtml(settingsUrl)}" rel="noopener noreferrer" style="color:#464644;text-decoration:underline;">Einstellungen</a>
                <span style="color:#D8D7D3;margin:0 6px;" aria-hidden="true">·</span>
                <a href="https://levcon.ai/datenschutz" rel="noopener noreferrer" style="color:#464644;text-decoration:underline;">Datenschutz</a>
                <span style="color:#D8D7D3;margin:0 6px;" aria-hidden="true">·</span>
                <a href="https://levcon.ai/impressum" rel="noopener noreferrer" style="color:#464644;text-decoration:underline;">Impressum</a>
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ── RENDER EN NEWSLETTER ───────────────────────────────────────
function renderEn(news, unsubUrl, settingsUrl, dateEn) {
  const allItems = news.items || [];
  const deItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'de');
  const enItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'en');

  const deBlock = deItems.map(it => renderItem(it, 'en')).join('');
  const enBlock = enItems.length > 0
    ? blockSeparator('International') + enItems.map(it => renderItem(it, 'en')).join('')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>AI News of the Day — Levcon.ai</title>
  <style>
    @media only screen and (max-width: 600px) {
      .lc-card { width: 100% !important; }
      .lc-pad-h { padding-left: 20px !important; padding-right: 20px !important; }
      .lc-item-thumb-cell { display: none !important; }
      .lc-date { font-size: 24px !important; }
      .lc-summary { font-size: 16px !important; }
      .lc-item-headline { font-size: 17px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F0EFEC;font-family:Arial,Helvetica,sans-serif;color:#464644;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;line-height:1.5;">

  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#F0EFEC;">
    ${escapeHtml(news.summaryEn || '').substring(0, 100)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0EFEC;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" class="lc-card" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #D8D7D3;">

          <tr>
            <td class="lc-pad-h" style="padding:36px 32px 20px 32px;text-align:center;border-bottom:1px solid #D8D7D3;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;letter-spacing:0.26em;text-transform:uppercase;color:#464644;font-weight:400;">
                LEVCON<span style="color:#C8102E;">.AI</span>
              </div>
            </td>
          </tr>

          <tr>
            <td class="lc-pad-h" style="padding:40px 32px 0 32px;text-align:center;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#8A8A85;margin-bottom:14px;font-weight:400;">
                AI News of the Day
              </div>
              <h1 class="lc-date" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;font-style:italic;color:#464644;line-height:1.2;letter-spacing:-0.01em;">
                ${escapeHtml(dateEn)}
              </h1>
            </td>
          </tr>

          <tr>
            <td class="lc-pad-h" style="padding:28px 32px 8px 32px;">
              <p class="lc-summary" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.6;color:#464644;font-weight:400;">
                ${escapeHtml(news.summaryEn || '')}
              </p>
            </td>
          </tr>

          <tr>
            <td class="lc-pad-h" style="padding:28px 32px 0 32px;">
              ${deBlock}${enBlock}
            </td>
          </tr>

          <tr>
            <td class="lc-pad-h" style="padding:32px 32px 36px 32px;border-top:1px solid #D8D7D3;">
              <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8A8A85;font-weight:300;">
                You are receiving this email because you subscribed to Levcon AI News.
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#8A8A85;font-weight:300;">
                <a href="https://levcon.ai" rel="noopener noreferrer" style="color:#464644;text-decoration:underline;">Levcon.ai</a>
                <span style="color:#D8D7D3;margin:0 6px;" aria-hidden="true">·</span>
                <a href="${escapeHtml(settingsUrl)}" rel="noopener noreferrer" style="color:#464644;text-decoration:underline;">Settings</a>
                <span style="color:#D8D7D3;margin:0 6px;" aria-hidden="true">·</span>
                <a href="https://levcon.ai/datenschutz" rel="noopener noreferrer" style="color:#464644;text-decoration:underline;">Privacy</a>
                <span style="color:#D8D7D3;margin:0 6px;" aria-hidden="true">·</span>
                <a href="https://levcon.ai/impressum" rel="noopener noreferrer" style="color:#464644;text-decoration:underline;">Legal Notice</a>
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════

const siteUrl = 'https://levcon.ai';
const out = [];

// Subscriber-Liste aus API-Wrapper extrahieren
let subscribers = [];
if (items.length === 1 && items[0].json?.subscribers) {
  subscribers = items[0].json.subscribers;
} else if (items.length > 0 && items[0].json?.email) {
  subscribers = items.map(i => i.json);
} else {
  console.log('[Newsletter] ⚠️ Fetch Subscribers Output:', JSON.stringify(items[0]?.json).substring(0, 500));
  throw new Error('No subscribers found. Check Fetch Subscribers node output.');
}

console.log(`[Newsletter] ${subscribers.length} Subscriber vom API erhalten`);

for (const s of subscribers) {
  const lang = (s.language || 'de').toLowerCase();
  const unsubToken = s.unsubscribeToken || s.confirmToken || s.id;
  const unsubUrl = `${siteUrl}/api/ai-news/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
  // Settings-URL: öffnet /ai-news?settings=<token> — User kann dort
  // Sprache, Frequenz, News-Sprachen ändern ODER abbesteln.
  const settingsUrl = `${siteUrl}/ai-news?settings=${encodeURIComponent(unsubToken)}`;

  // Skip wenn heute schon gesendet
  if (s.lastSentDate) {
    const lastSent = new Date(s.lastSentDate);
    const todayDate = new Date(today + 'T00:00:00Z');
    if (lastSent.getTime() === todayDate.getTime()) {
      console.log(`[Newsletter] Skip ${s.email} — already sent today`);
      continue;
    }
  }

  let html, subject;
  if (lang === 'en') {
    html = renderEn(news, unsubUrl, settingsUrl, dateEn);
    subject = `AI News · ${dateEn}`;
  } else {
    html = renderDe(news, unsubUrl, settingsUrl, dateDe);
    subject = `KI-News · ${dateDe}`;
  }

  out.push({
    json: {
      email: s.email,
      subject,
      html,
      subscriberId: s.id,
      subscriberLanguage: lang,
      listUnsubscribe: `<mailto:news@levcon.ai?subject=Unsubscribe>, <${unsubUrl}>`,
      listUnsubscribePost: 'List-Unsubscribe=One-Click',
      lastSentDate
    }
  });
}

console.log(`[Newsletter] ${out.length} E-Mails gerendert (${subscribers.length - out.length} skipped wegen lastSentDate)`);
return out;

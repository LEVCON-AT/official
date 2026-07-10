// ═══════════════════════════════════════════════════════════════
//  RENDER NEWSLETTER HTML (v2 — Sprint 14b+c)
//
//  Vereinfachung Sprint 14b:
//   - Daily/Weekly/Digest senden alle die gleichen TAGESNEWS
//   - Keine Aggregation mehr (niemand liest News von vor 30 Tagen)
//   - Weekly/Digest prüfen nur ob heute schon gesendet → falls ja, skip
//
//  Verbesserung Sprint 14c:
//   - Newsletter in 2 Blöcke: EN-Items zuerst, DE-Items danach
//     (User der /en/ subscribed hat → will EN-News, DE als Bonus)
//   - Translate-Link bei jedem Item:
//     - DE-Newsletter + EN-Item → "Auf Deutsch lesen →" (Google Translate)
//     - EN-Newsletter + DE-Item → "Read in English →" (Google Translate)
//   - Summary in Newsletter-Sprache (wie auf der Website)
//
//  Input:  items from Fetch Subscribers (ein Item pro Subscriber)
//  Uses:   $('Fetch Today News').first().json für News-Daten
//  Output: ein Item pro Subscriber mit email + subject + html + headers
// ═══════════════════════════════════════════════════════════════

const news = $("Fetch Today News").first().json;
if (!news || !news.items) {
  throw new Error('No news data available from Fetch Today News node');
}

const today = news.date || new Date().toISOString().substring(0, 10);
const lastSentDate = today;

const DE_MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const d = new Date(today + 'T00:00:00Z');
const dateDe = `${d.getUTCDate()}. ${DE_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const dateEn = `${EN_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

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

// Google Translate URL: übersetzt die Original-Seite in die Zielsprache
function translateUrl(originalUrl, targetLang) {
  return `https://translate.google.com/translate?sl=auto&tl=${targetLang}&u=${encodeURIComponent(originalUrl)}`;
}

// ═══════════════════════════════════════════════════════════════
//  ITEM RENDERING (mit Translate-Link)
// ═══════════════════════════════════════════════════════════════

// Rendert ein Item für DE-Newsletter (deutsche Beschreibung, deutscher Translate-Link)
function itemDe(it) {
  const headline = escapeHtml(it.headlineDe || it.headline || '');
  const source = escapeHtml(it.source || '');
  const url = escapeHtml(cleanUrl(it.sourceUrl || it.url || ''));
  const desc = escapeHtml(it.descriptionDe || it.summary || '');
  const itemLang = (it.languageOrig || 'en').toLowerCase();

  // Translate-Link: nur wenn Original-Sprache ≠ Newsletter-Sprache
  let translateLink = '';
  if (itemLang !== 'de') {
    const tUrl = escapeHtml(translateUrl(it.sourceUrl || it.url || '', 'de'));
    translateLink = ` · <a href="${tUrl}" style="color:#b91c1c;">Auf Deutsch lesen →</a>`;
  }

  return `<article style="margin-bottom:24px;">
    <h3 style="margin:0 0 4px 0;font-size:16px;font-family:Georgia,'Times New Roman',serif;">${headline}</h3>
    <p style="margin:0 0 8px 0;font-size:12px;color:#888;">${source} · <a href="${url}" style="color:#b91c1c;">Weiterlesen →</a>${translateLink}</p>
    <p style="margin:0;font-size:14px;line-height:1.5;">${desc}</p>
  </article>`;
}

// Rendert ein Item für EN-Newsletter (englische Beschreibung, englischer Translate-Link)
function itemEn(it) {
  const headline = escapeHtml(it.headlineEn || it.headline || '');
  const source = escapeHtml(it.source || '');
  const url = escapeHtml(cleanUrl(it.sourceUrl || it.url || ''));
  const desc = escapeHtml(it.descriptionEn || it.summary || '');
  const itemLang = (it.languageOrig || 'en').toLowerCase();

  // Translate-Link: nur wenn Original-Sprache ≠ Newsletter-Sprache
  let translateLink = '';
  if (itemLang !== 'en') {
    const tUrl = escapeHtml(translateUrl(it.sourceUrl || it.url || '', 'en'));
    translateLink = ` · <a href="${tUrl}" style="color:#b91c1c;">Read in English →</a>`;
  }

  return `<article style="margin-bottom:24px;">
    <h3 style="margin:0 0 4px 0;font-size:16px;font-family:Georgia,'Times New Roman',serif;">${headline}</h3>
    <p style="margin:0 0 8px 0;font-size:12px;color:#888;">${source} · <a href="${url}" style="color:#b91c1c;">Read more →</a>${translateLink}</p>
    <p style="margin:0;font-size:14px;line-height:1.5;">${desc}</p>
  </article>`;
}

// ═══════════════════════════════════════════════════════════════
//  BLOCK STRUKTUR (EN zuerst, DE danach)
// ═══════════════════════════════════════════════════════════════
//  Newsletter hat 2 Blöcke:
//  1. "AI News International" — alle EN-Items
//  2. "KI-News aus dem DACH-Raum" — alle DE-Items
//
//  User der /en/ subscribed hat → will EN-News primär sehen
//  DE-Items als Bonus dahinter (mit Translate-Link)
// ═══════════════════════════════════════════════════════════════

function renderDe(news, unsubUrl, dateDe) {
  const allItems = news.items || [];
  const enItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'en');
  const deItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'de');

  const enBlock = enItems.length > 0
    ? `<h2 style="font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px 0;padding-bottom:8px;border-bottom:1px solid #ccc;">AI News International</h2>${enItems.map(itemDe).join('')}`
    : '';
  const deBlock = deItems.length > 0
    ? `<h2 style="font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin:32px 0 16px 0;padding-bottom:8px;border-bottom:1px solid #ccc;">KI-News aus dem DACH-Raum</h2>${deItems.map(itemDe).join('')}`
    : '';

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KI-News · ${escapeHtml(dateDe)}</title></head><body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;background:#f0efec;">
    <h1 style="font-family:Georgia,'Times New Roman',serif;color:#b91c1c;margin:0 0 8px 0;">KI-News · ${escapeHtml(dateDe)}</h1>
    <p style="font-style:italic;color:#555;line-height:1.5;margin:0 0 24px 0;">${escapeHtml(news.summaryDe || '')}</p>
    <hr style="border:0;border-top:1px solid #ccc;margin:24px 0;">
    ${enBlock}
    ${deBlock}
    <hr style="border:0;border-top:1px solid #ccc;margin:24px 0;">
    <p style="font-size:12px;color:#999;">Levcon.ai · <a href="${escapeHtml(unsubUrl)}" style="color:#999;">Abmelden / Unsubscribe</a></p>
  </body></html>`;
}

function renderEn(news, unsubUrl, dateEn) {
  const allItems = news.items || [];
  const enItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'en');
  const deItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'de');

  const enBlock = enItems.length > 0
    ? `<h2 style="font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px 0;padding-bottom:8px;border-bottom:1px solid #ccc;">AI News International</h2>${enItems.map(itemEn).join('')}`
    : '';
  const deBlock = deItems.length > 0
    ? `<h2 style="font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin:32px 0 16px 0;padding-bottom:8px;border-bottom:1px solid #ccc;">KI-News aus dem DACH-Raum</h2>${deItems.map(itemEn).join('')}`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI News · ${escapeHtml(dateEn)}</title></head><body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;background:#f0efec;">
    <h1 style="font-family:Georgia,'Times New Roman',serif;color:#b91c1c;margin:0 0 8px 0;">AI News · ${escapeHtml(dateEn)}</h1>
    <p style="font-style:italic;color:#555;line-height:1.5;margin:0 0 24px 0;">${escapeHtml(news.summaryEn || '')}</p>
    <hr style="border:0;border-top:1px solid #ccc;margin:24px 0;">
    ${enBlock}
    ${deBlock}
    <hr style="border:0;border-top:1px solid #ccc;margin:24px 0;">
    <p style="font-size:12px;color:#999;">Levcon.ai · <a href="${escapeHtml(unsubUrl)}" style="color:#999;">Unsubscribe</a></p>
  </body></html>`;
}

const siteUrl = ($env && $env.NEXT_PUBLIC_SITE_URL) || 'https://levcon.ai';
const out = [];

for (const sub of items) {
  const s = sub.json;
  const lang = (s.language || 'de').toLowerCase();
  const unsubToken = s.unsubscribeToken || s.id;
  const unsubUrl = `${siteUrl}/api/ai-news/unsubscribe?token=${encodeURIComponent(unsubToken)}`;

  // Skip wenn heute schon gesendet (verhindert Doppelversand bei Weekly/Digest)
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
    html = renderEn(news, unsubUrl, dateEn);
    subject = `AI News · ${dateEn}`;
  } else {
    html = renderDe(news, unsubUrl, dateDe);
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

console.log(`[Newsletter] ${out.length} E-Mails gerendert (${items.length - out.length} skipped wegen lastSentDate)`);
return out;

// Render Newsletter HTML per subscriber (DE or EN)
// Input: items from Fetch Subscribers (one item per subscriber)
// Uses $('Fetch Today News').first().json for the news data
// Output: one item per subscriber with email + subject + html + headers + lastSentDate
//
// v3: Original-Code + 2 neue Features (minimal-invasiv):
//   1. 2 Blöcke: DE-Items (DACH) zuerst, EN-Items (International) danach
//   2. Translate-Link bei fremdsprachigen Items
// Layout bleibt 1:1 wie im Original — keine neuen Header, keine Strukturänderung.

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

// Google Translate URL
function translateUrl(originalUrl, targetLang) {
  return `https://translate.google.com/translate?sl=auto&tl=${targetLang}&u=${encodeURIComponent(originalUrl)}`;
}

// ── ITEM RENDERING ─────────────────────────────────────────────
// NEU: Translate-Link dezent hinten angefügt (gleiche Style wie "Weiterlesen")
// NEU: headlineDe/headlineEn verwenden (fallback auf headline)

function itemDe(it) {
  const headline = escapeHtml(it.headlineDe || it.headline || '');
  const source = escapeHtml(it.source || '');
  const url = escapeHtml(cleanUrl(it.sourceUrl || it.url || ''));
  const desc = escapeHtml(it.descriptionDe || it.summary || '');
  const itemLang = (it.languageOrig || 'en').toLowerCase();
  let translateLink = '';
  if (itemLang !== 'de') {
    const tUrl = escapeHtml(translateUrl(it.sourceUrl || it.url || '', 'de'));
    translateLink = ` · <a href="${tUrl}" style="color:#b91c1c;">Auf Deutsch lesen →</a>`;
  }
  return `<article style="margin-bottom:24px;"><h3 style="margin:0 0 4px 0;font-size:16px;font-family:Georgia,'Times New Roman',serif;">${headline}</h3><p style="margin:0 0 8px 0;font-size:12px;color:#888;">${source} · <a href="${url}" style="color:#b91c1c;">Weiterlesen →</a>${translateLink}</p><p style="margin:0;font-size:14px;line-height:1.5;">${desc}</p></article>`;
}

function itemEn(it) {
  const headline = escapeHtml(it.headlineEn || it.headline || '');
  const source = escapeHtml(it.source || '');
  const url = escapeHtml(cleanUrl(it.sourceUrl || it.url || ''));
  const desc = escapeHtml(it.descriptionEn || it.summary || '');
  const itemLang = (it.languageOrig || 'en').toLowerCase();
  let translateLink = '';
  if (itemLang !== 'en') {
    const tUrl = escapeHtml(translateUrl(it.sourceUrl || it.url || '', 'en'));
    translateLink = ` · <a href="${tUrl}" style="color:#b91c1c;">Read in English →</a>`;
  }
  return `<article style="margin-bottom:24px;"><h3 style="margin:0 0 4px 0;font-size:16px;font-family:Georgia,'Times New Roman',serif;">${headline}</h3><p style="margin:0 0 8px 0;font-size:12px;color:#888;">${source} · <a href="${url}" style="color:#b91c1c;">Read more →</a>${translateLink}</p><p style="margin:0;font-size:14px;line-height:1.5;">${desc}</p></article>`;
}

// ── RENDER DE NEWSLETTER ───────────────────────────────────────
// NEU: 2 Blöcke — DE-Items (DACH) zuerst, dann EN-Items (International).
// Trennung: dünne <hr> zwischen den Blöcken (gleiches Style wie ohnehin).
function renderDe(news, unsubUrl, dateDe) {
  const allItems = news.items || [];
  const deItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'de');
  const enItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'en');

  const deBlock = deItems.map(itemDe).join('');
  // EN-Block nur wenn EN-Items vorhanden — getrennt durch dünne Linie
  const enBlock = enItems.length > 0
    ? `<hr style="border:0;border-top:1px solid #ccc;margin:24px 0;">${enItems.map(itemDe).join('')}`
    : '';

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KI-News · ${escapeHtml(dateDe)}</title></head><body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;background:#f0efec;"><h1 style="font-family:Georgia,'Times New Roman',serif;color:#b91c1c;margin:0 0 8px 0;">KI-News · ${escapeHtml(dateDe)}</h1><p style="font-style:italic;color:#555;line-height:1.5;margin:0 0 24px 0;">${escapeHtml(news.summaryDe || '')}</p><hr style="border:0;border-top:1px solid #ccc;margin:24px 0;">${deBlock}${enBlock}<hr style="border:0;border-top:1px solid #ccc;margin:24px 0;"><p style="font-size:12px;color:#999;">Levcon.ai · <a href="${escapeHtml(unsubUrl)}" style="color:#999;">Abmelden / Unsubscribe</a></p></body></html>`;
}

function renderEn(news, unsubUrl, dateEn) {
  const allItems = news.items || [];
  const deItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'de');
  const enItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'en');

  const deBlock = deItems.map(itemEn).join('');
  const enBlock = enItems.length > 0
    ? `<hr style="border:0;border-top:1px solid #ccc;margin:24px 0;">${enItems.map(itemEn).join('')}`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI News · ${escapeHtml(dateEn)}</title></head><body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;background:#f0efec;"><h1 style="font-family:Georgia,'Times New Roman',serif;color:#b91c1c;margin:0 0 8px 0;">AI News · ${escapeHtml(dateEn)}</h1><p style="font-style:italic;color:#555;line-height:1.5;margin:0 0 24px 0;">${escapeHtml(news.summaryEn || '')}</p><hr style="border:0;border-top:1px solid #ccc;margin:24px 0;">${deBlock}${enBlock}<hr style="border:0;border-top:1px solid #ccc;margin:24px 0;"><p style="font-size:12px;color:#999;">Levcon.ai · <a href="${escapeHtml(unsubUrl)}" style="color:#999;">Unsubscribe</a></p></body></html>`;
}

const siteUrl = 'https://levcon.ai';
const out = [];

// Subscriber-Liste aus API-Wrapper extrahieren
// Die Levcon API liefert: { count: N, subscribers: [...] }
let subscribers = [];
if (items.length === 1 && items[0].json?.subscribers) {
  subscribers = items[0].json.subscribers;
} else if (items.length > 0 && items[0].json?.email) {
  subscribers = items.map(i => i.json);
} else {
  throw new Error('No subscribers found. Check Fetch Subscribers node output.');
}

for (const s of subscribers) {
  const lang = (s.language || 'de').toLowerCase();
  const unsubToken = s.unsubscribeToken || s.confirmToken || s.id;
  const unsubUrl = `${siteUrl}/api/ai-news/unsubscribe?token=${encodeURIComponent(unsubToken)}`;

  // Skip wenn heute schon gesendet
  if (s.lastSentDate) {
    const lastSent = new Date(s.lastSentDate);
    const todayDate = new Date(today + 'T00:00:00Z');
    if (lastSent.getTime() === todayDate.getTime()) {
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

return out;

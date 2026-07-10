// ═══════════════════════════════════════════════════════════════
//  RENDER NEWSLETTER HTML (v3 — Sprint 14 final)
//
//  Was geändert wurde:
//   1. Layout 1:1 vom originalen workflow-03 wiederhergestellt
//      (gleiches schlichtes Styling wie die Website)
//   2. 2 Blöcke: DE-Items (DACH) zuerst, dann EN-Items (International)
//   3. Translate-Link bei jedem Item (neue Funktionalität beibehalten)
//   4. Block-Trennung dezent (dünne Linie + kleines muted Label)
//   5. Datum robust parsen (NaN-Bug fix)
//   6. Subscriber-Liste aus API-Wrapper extrahieren
//   7. confirmToken als Unsubscribe-Token verwenden
//   8. Skip wenn heute schon gesendet
// ═══════════════════════════════════════════════════════════════

const news = $("Fetch Today News").first().json;
if (!news || !news.items) {
  throw new Error('No news data available from Fetch Today News node');
}

// Datum robust parsen — kann als ISO String oder YYYY-MM-DD kommen.
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

// ── ITEM RENDERING (mit Translate-Link) ────────────────────────
// Styling 1:1 vom originalen workflow-03 übernommen.
// Translate-Link wird dezent hinten angefügt (gleiche Farbe wie
// "Weiterlesen" / "Read more" — #b91c1c).

function itemDe(it) {
  const headline = escapeHtml(it.headlineDe || it.headline || '');
  const source = escapeHtml(it.source || '');
  const url = escapeHtml(cleanUrl(it.sourceUrl || it.url || ''));
  const desc = escapeHtml(it.descriptionDe || it.summary || '');
  const itemLang = (it.languageOrig || 'en').toLowerCase();

  // Translate-Link: nur wenn Original-Sprache ≠ Newsletter-Sprache (DE)
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

  // Translate-Link: nur wenn Original-Sprache ≠ Newsletter-Sprache (EN)
  let translateLink = '';
  if (itemLang !== 'en') {
    const tUrl = escapeHtml(translateUrl(it.sourceUrl || it.url || '', 'en'));
    translateLink = ` · <a href="${tUrl}" style="color:#b91c1c;">Read in English →</a>`;
  }

  return `<article style="margin-bottom:24px;"><h3 style="margin:0 0 4px 0;font-size:16px;font-family:Georgia,'Times New Roman',serif;">${headline}</h3><p style="margin:0 0 8px 0;font-size:12px;color:#888;">${source} · <a href="${url}" style="color:#b91c1c;">Read more →</a>${translateLink}</p><p style="margin:0;font-size:14px;line-height:1.5;">${desc}</p></article>`;
}

// ── BLOCK SEPARATOR (dezente Trennung zwischen DE und EN) ──────
// Schlichter Style passend zur Website: dünne Linie + kleines
// muted Label, nicht aufdringlich.
function blockSeparator(labelDe, labelEn) {
  // DE-Newsletter bekommt deutsches Label, EN-Newsletter englisches
  const label = labelDe;  // wird von renderDe/renderEn gesetzt
  return `<hr style="border:0;border-top:1px solid #ccc;margin:32px 0 24px 0;"><p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999;margin:0 0 16px 0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">${escapeHtml(label)}</p>`;
}

// ── RENDER DE NEWSLETTER ───────────────────────────────────────
// Reihenfolge: DACH-News zuerst, dann International.
function renderDe(news, unsubUrl, dateDe) {
  const allItems = news.items || [];
  const deItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'de');
  const enItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'en');

  // Block 1: DACH-News
  const deBlock = deItems.map(itemDe).join('');

  // Block 2: International (nur wenn EN-Items vorhanden)
  let enBlock = '';
  if (enItems.length > 0) {
    enBlock = blockSeparator('International') + enItems.map(itemDe).join('');
  }

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KI-News · ${escapeHtml(dateDe)}</title></head><body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;background:#f0efec;"><h1 style="font-family:Georgia,'Times New Roman',serif;color:#b91c1c;margin:0 0 8px 0;">KI-News · ${escapeHtml(dateDe)}</h1><p style="font-style:italic;color:#555;line-height:1.5;margin:0 0 24px 0;">${escapeHtml(news.summaryDe || '')}</p><hr style="border:0;border-top:1px solid #ccc;margin:24px 0;">${deBlock}${enBlock}<hr style="border:0;border-top:1px solid #ccc;margin:24px 0;"><p style="font-size:12px;color:#999;">Levcon.ai · <a href="${escapeHtml(unsubUrl)}" style="color:#999;">Abmelden / Unsubscribe</a></p></body></html>`;
}

// ── RENDER EN NEWSLETTER ───────────────────────────────────────
// Reihenfolge: DACH-News zuerst, dann International.
// (Auch EN-Newsletter: DACH zuerst — Owner möchte DE-Items oben)
function renderEn(news, unsubUrl, dateEn) {
  const allItems = news.items || [];
  const deItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'de');
  const enItems = allItems.filter(it => (it.languageOrig || 'en').toLowerCase() === 'en');

  // Block 1: DACH-News (übersetzt für EN-Reader)
  const deBlock = deItems.map(itemEn).join('');

  // Block 2: International
  let enBlock = '';
  if (enItems.length > 0) {
    enBlock = blockSeparator('International') + enItems.map(itemEn).join('');
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI News · ${escapeHtml(dateEn)}</title></head><body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;background:#f0efec;"><h1 style="font-family:Georgia,'Times New Roman',serif;color:#b91c1c;margin:0 0 8px 0;">AI News · ${escapeHtml(dateEn)}</h1><p style="font-style:italic;color:#555;line-height:1.5;margin:0 0 24px 0;">${escapeHtml(news.summaryEn || '')}</p><hr style="border:0;border-top:1px solid #ccc;margin:24px 0;">${deBlock}${enBlock}<hr style="border:0;border-top:1px solid #ccc;margin:24px 0;"><p style="font-size:12px;color:#999;">Levcon.ai · <a href="${escapeHtml(unsubUrl)}" style="color:#999;">Unsubscribe</a></p></body></html>`;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN: Subscriber-Daten holen + Newsletter rendern
// ═══════════════════════════════════════════════════════════════

const siteUrl = 'https://levcon.ai';
const out = [];

// Subscriber-Liste aus API-Wrapper extrahieren
// Die Levcon API liefert: { count: N, subscribers: [...] }
let subscribers = [];

if (items.length === 1 && items[0].json?.subscribers) {
  // Format 1: [{ json: { count, subscribers: [...] } }]
  subscribers = items[0].json.subscribers;
} else if (items.length > 0 && items[0].json?.email) {
  // Format 2: [{ json: { email, ... } }, ...] (bereits geflacht)
  subscribers = items.map(i => i.json);
} else {
  console.log('[Newsletter] ⚠️ Fetch Subscribers Output:', JSON.stringify(items[0]?.json).substring(0, 500));
  throw new Error('No subscribers found. Check Fetch Subscribers node output.');
}

console.log(`[Newsletter] ${subscribers.length} Subscriber vom API erhalten`);

for (const s of subscribers) {
  const lang = (s.language || 'de').toLowerCase();
  // Unsubscribe-Token: API liefert confirmToken (nicht unsubscribeToken)
  const unsubToken = s.unsubscribeToken || s.confirmToken || s.id;
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

console.log(`[Newsletter] ${out.length} E-Mails gerendert (${subscribers.length - out.length} skipped wegen lastSentDate)`);
return out;

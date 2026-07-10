// URL slug ↔ Panel ID mapping
// Used by [panel]/page.tsx for routing + SEO

export type PanelSlug = 'ki-schulungen' | 'framework' | 'datenstrategie' | 'ai-news' | 'faq' | 'kontakt' | 'impressum' | 'datenschutz';
export type PanelId = 'schulungen' | 'framework' | 'privacy' | 'ainews' | 'faq' | 'kontakt' | 'impressum' | 'datenschutz';

// DE slugs (no prefix)
export const DE_SLUGS: Record<PanelId, string> = {
  schulungen: 'ki-schulungen',
  framework: 'framework',
  privacy: 'datenstrategie',
  ainews: 'ai-news',
  faq: 'faq',
  kontakt: 'kontakt',
  impressum: 'impressum',
  datenschutz: 'datenschutz',
};

// EN slugs (under /en/)
export const EN_SLUGS: Record<PanelId, string> = {
  schulungen: 'ai-training',
  framework: 'framework',
  privacy: 'data-strategy',
  ainews: 'ai-news',
  faq: 'faq',
  kontakt: 'contact',
  impressum: 'legal-notice',
  datenschutz: 'privacy-policy',
};

// Reverse maps: slug → panelId
export const DE_SLUG_TO_PANEL: Record<string, PanelId> = Object.fromEntries(
  Object.entries(DE_SLUGS).map(([id, slug]) => [slug, id as PanelId])
);

export const EN_SLUG_TO_PANEL: Record<string, PanelId> = Object.fromEntries(
  Object.entries(EN_SLUGS).map(([id, slug]) => [slug, id as PanelId])
);

// Get slug for panel in given locale
export function getPanelSlug(panelId: PanelId, locale: string): string {
  return locale === 'en' ? EN_SLUGS[panelId] : DE_SLUGS[panelId];
}

// Get panel ID from slug and locale
export function getPanelFromSlug(slug: string, locale: string): PanelId | null {
  const map = locale === 'en' ? EN_SLUG_TO_PANEL : DE_SLUG_TO_PANEL;
  return map[slug] || null;
}

// Get all valid slugs for a locale (for generateStaticParams)
export function getAllSlugs(locale: string): string[] {
  return locale === 'en' ? Object.values(EN_SLUGS) : Object.values(DE_SLUGS);
}

// Metadata per panel (title + description for SEO)
export const PANEL_META: Record<PanelId, { titleDe: string; titleEn: string; descDe: string; descEn: string }> = {
  schulungen: {
    titleDe: 'KI Schulungen — Levcon.ai',
    titleEn: 'AI Training — Levcon.ai',
    descDe: 'Individuelle KI-Schulungen für Führungskräfte, Teams und IT. Praktisch, anwendbar, ohne Vorwissen.',
    descEn: 'Custom AI training for executives, teams and IT. Practical, applicable, no prior knowledge needed.',
  },
  framework: {
    titleDe: 'Framework — ZIEL → HEBEL → KONTROLLE — Levcon.ai',
    titleEn: 'Framework — GOAL → LEVER → CONTROL — Levcon.ai',
    descDe: 'Strukturierte Methode für KI-Projekte: Ziel definieren, Hebel identifizieren, Kontrolle sichern.',
    descEn: 'Structured method for AI projects: define goals, identify levers, ensure control.',
  },
  privacy: {
    titleDe: 'Datenstrategie — Levcon.ai',
    titleEn: 'Data Strategy — Levcon.ai',
    descDe: 'Drei Stufen, eine Strategie: Gemeinsam erarbeiten wir, wo Ihre Daten hingehören.',
    descEn: 'Three tiers, one strategy: together we determine where your data belongs.',
  },
  ainews: {
    titleDe: 'AI News — Tägliche KI-News kuratiert — Levcon.ai',
    titleEn: 'AI News — Daily AI News Curated — Levcon.ai',
    descDe: 'Was die KI-Welt heute bewegt — kuratiert, nicht kopiert. Täglich aktualisiert.',
    descEn: 'What moves the AI world today — curated, not copied. Updated daily.',
  },
  faq: {
    titleDe: 'FAQ — Häufige Fragen — Levcon.ai',
    titleEn: 'FAQ — Frequently Asked Questions — Levcon.ai',
    descDe: 'Antworten auf die häufigsten Fragen zu KI-Schulungen, Beratung und Projekten.',
    descEn: 'Answers to the most common questions about AI training, consulting and projects.',
  },
  kontakt: {
    titleDe: 'Kontakt — Levcon.ai',
    titleEn: 'Contact — Levcon.ai',
    descDe: 'Jedes gute Projekt beginnt mit einem Gespräch. Rufen Sie an oder schreiben Sie mir.',
    descEn: 'Every good project starts with a conversation. Call or write to me.',
  },
  impressum: {
    titleDe: 'Impressum — Levcon.ai',
    titleEn: 'Legal Notice — Levcon.ai',
    descDe: 'Angaben gemäß § 5 ECG: Mst. Enric-Bernard Sep-Albi, BA, MBA, Pfalzgasse 37/2/4, 1220 Wien.',
    descEn: 'Information pursuant to § 5 ECG: Mst. Enric-Bernard Sep-Albi, BA, MBA, Pfalzgasse 37/2/4, 1220 Vienna.',
  },
  datenschutz: {
    titleDe: 'Datenschutzerklärung — Levcon.ai',
    titleEn: 'Privacy Policy — Levcon.ai',
    descDe: 'Datenschutzerklärung gemäß DSGVO für levcon.ai — Datenminimierung, Double-Opt-In, keine Tracker.',
    descEn: 'Privacy policy according to GDPR for levcon.ai — data minimization, double opt-in, no trackers.',
  },
};

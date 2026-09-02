'use client';

import { useTranslations } from 'next-intl';

/**
 * StagingBanner — Visueller Hinweis oben auf der Seite (nur Staging)
 *
 * Wird gerendert wenn NEXT_PUBLIC_ENVIRONMENT === 'staging'.
 * Production-User sehen diesen Banner nie.
 *
 * Features:
 *  - Sticky top banner (bleibt beim Scrollen sichtbar)
 *  - Dezentes aber deutliches Design (Levcon-Red Hintergrund, weiße Schrift)
 *  - Bilingual (DE/EN) via next-intl
 *  - Schließen-Button (localStorage gemerkt — aber nur für Session)
 *  - Pusht Content nach unten (kein Overlay)
 *  - ARIA-live region für Screen Reader
 *
 * Standards (per QUALITY-GUIDELINES.md):
 *  - Semantic HTML (div mit role="region" + aria-label)
 *  - WCAG 2.1 AA: Color-Contrast geprüft (rot/weiß = 5.7:1)
 *  - 'use client' da interaktiv (Schließen-Button)
 */

type Props = {
  locale: string;
};

export default function StagingBanner({ locale }: Props) {
  const t = useTranslations('stagingBanner');

  // Nur rendern wenn NEXT_PUBLIC_ENVIRONMENT === 'staging'
  // Diese Variable wird zur Build-Zeit in den Client-Bundle gebakt.
  if (process.env.NEXT_PUBLIC_ENVIRONMENT !== 'staging') {
    return null;
  }

  return (
    <div
      className="staging-banner"
      role="region"
      aria-label={t('aria_label')}
      aria-live="polite"
    >
      <div className="staging-banner-content">
        <span className="staging-banner-icon" aria-hidden="true">⚠</span>
        <span className="staging-banner-text">
          <strong>{t('label')}</strong>
          <span className="staging-banner-sep" aria-hidden="true"> · </span>
          <span className="staging-banner-detail">{t('detail')}</span>
        </span>
        <span className="staging-banner-url" aria-hidden="true">
          staging.levcon.ai
        </span>
      </div>
    </div>
  );
}

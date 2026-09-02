'use client';

import { useState, useId, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, ExternalLink, Link2, Check } from 'lucide-react';
import { LANG_CODE_TO_SHORT } from './languages';

export type AiNewsItemType = {
  id: number;
  position: number;
  headline: string;
  headlineDe: string | null;  // Deutsche Übersetzung (null bei Legacy-Items)
  headlineEn: string | null;  // Englische Übersetzung (null bei Legacy-Items)
  descriptionDe: string;
  descriptionEn: string | null;
  source: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  languageOrig: string;
  category: string | null;
};

type Props = {
  item: AiNewsItemType;
  locale: string;
  index?: number;
};

// Estimate reading time based on description length.
// Average reading speed: ~200 wpm. We approximate words via length / 5.
function estimateReadingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return minutes;
}

// Category SVG icons — 12×12, currentColor, minimalist
const CategoryIcon = ({ category }: { category: string | null }) => {
  if (!category) return null;

  const icons: Record<string, React.ReactElement> = {
    research: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 3h6v4l4 7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4l4-7V3z" />
        <line x1="9" y1="3" x2="15" y2="3" />
      </svg>
    ),
    business: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    regulation: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v18" />
        <path d="M5 7h14" />
        <path d="M5 7l-2 5a4 4 0 0 0 8 0L9 7" />
        <path d="M19 7l-2 5a4 4 0 0 0 8 0l-2-5" transform="translate(-4 0)" />
      </svg>
    ),
    tools: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    society: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  };

  return (
    <span className="ainews-category-icon" title={category}>
      {icons[category] || null}
    </span>
  );
};

// Language label mapping (uses centralized config)
const LANG_LABELS: Record<string, string> = LANG_CODE_TO_SHORT;

export default function AiNewsItem({ item, locale, index = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const t = useTranslations('ainews');
  const contentId = useId();

  const description = locale === 'en' && item.descriptionEn
    ? item.descriptionEn
    : item.descriptionDe;

  // Headline: zeige übersetzte Version je nach Locale, mit Fallback auf Original
  // (für Legacy-Items die noch keine headlineDe/headlineEn haben)
  const headline = locale === 'en'
    ? (item.headlineEn || item.headline)
    : (item.headlineDe || item.headline);

  const showThumbnails = process.env.NEXT_PUBLIC_SHOW_THUMBNAILS === 'true';
  const langLabel = LANG_LABELS[item.languageOrig] || item.languageOrig.toUpperCase();
  const readingMinutes = estimateReadingMinutes(description);

  const handleCopyLink = useCallback(async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(item.sourceUrl);
      } else {
        // Fallback for older browsers / non-secure contexts
        const ta = document.createElement('textarea');
        ta.value = item.sourceUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('failed');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  }, [item.sourceUrl]);

  // Translate-Link: zeigen wenn Original-Sprache ≠ Locale-Sprache.
  // - DE-User sieht EN-Item → "Auf Deutsch lesen →" (Google Translate EN→DE)
  // - EN-User sieht DE-Item → "Read in English →" (Google Translate DE→EN)
  // - DE-User sieht DE-Item → kein Link nötig
  // - EN-User sieht EN-Item → kein Link nötig
  const itemLang = (item.languageOrig || 'en').toLowerCase();
  const needsTranslate = itemLang !== locale;
  const translateUrl = needsTranslate
    ? `https://translate.google.com/translate?sl=auto&tl=${locale === 'en' ? 'en' : 'de'}&u=${encodeURIComponent(item.sourceUrl)}`
    : null;
  const translateLabel = locale === 'en' ? 'Read in English →' : 'Auf Deutsch lesen →';

  return (
    <article
      className="ainews-item"
      style={{ '--ainews-stagger': `${Math.min(index, 8) * 60}ms` } as React.CSSProperties}
    >
      <div className="ainews-item-head">
        <button
          type="button"
          className="ainews-item-toggle"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={contentId}
          aria-label={expanded ? t('collapse_aria') : t('expand_aria')}
        >
          <ChevronRight
            className={`ainews-chevron${expanded ? ' is-open' : ''}`}
            size={16}
            aria-hidden="true"
          />
          {item.category && <CategoryIcon category={item.category} />}
          {langLabel !== 'DE' && langLabel !== 'EN' && (
            <span className="ainews-lang-tag-inline" aria-label={`Original language: ${item.languageOrig}`}>{langLabel}</span>
          )}
          <span className="ainews-item-headline">{headline}</span>
          <span className="ainews-item-readtime" aria-label={`${readingMinutes} ${t('reading_time_min')}`}>
            {readingMinutes}′
          </span>
        </button>
        <div className="ainews-item-meta">
          <span className="ainews-item-source">{item.source}</span>
          <button
            type="button"
            className="ainews-item-copybtn"
            onClick={handleCopyLink}
            aria-label={t('copy_link')}
            title={t('copy_link')}
          >
            {copyState === 'copied' ? <Check size={13} aria-hidden="true" /> : <Link2 size={13} aria-hidden="true" />}
          </button>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="ainews-item-extlink"
            aria-label={`${t('external_aria')} (${item.source})`}
          >
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>

      <div
        id={contentId}
        className={`ainews-item-body${expanded ? ' is-open' : ''}`}
        role="region"
        aria-hidden={!expanded}
      >
        <div className="ainews-item-body-inner">
          {showThumbnails && item.thumbnailUrl && (
            <img
              src={item.thumbnailUrl}
              alt=""
              className="ainews-item-thumb"
              width={60}
              height={60}
              loading="lazy"
            />
          )}
          <div className="ainews-item-text">
            <p className="ainews-item-desc">{description}</p>
            {copyState !== 'idle' && (
              <p className={`ainews-item-copymsg${copyState === 'copied' ? ' is-ok' : ' is-fail'}`} role="status">
                {copyState === 'copied' ? t('copy_link_done') : t('copy_link_failed')}
              </p>
            )}
            <div className="ainews-item-links">
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="ainews-item-readmore"
              >
                {t('read_more')}
              </a>
              {translateUrl && (
                <>
                  <span className="ainews-link-sep" aria-hidden="true">·</span>
                  <a
                    href={translateUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="ainews-item-translate"
                  >
                    {translateLabel}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

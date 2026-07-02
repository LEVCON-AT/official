'use client';

import { useState, useId } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, ExternalLink } from 'lucide-react';

export type AiNewsItemType = {
  id: number;
  position: number;
  headline: string;
  descriptionDe: string;
  descriptionEn: string | null;
  source: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  languageOrig: string;
};

type Props = {
  item: AiNewsItemType;
  locale: string;
};

export default function AiNewsItem({ item, locale }: Props) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations('ainews');
  const contentId = useId();

  const description = locale === 'en' && item.descriptionEn
    ? item.descriptionEn
    : item.descriptionDe;

  return (
    <article className="ainews-item">
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
          <span className="ainews-item-headline">{item.headline}</span>
        </button>
        <div className="ainews-item-meta">
          <span className="ainews-item-source">{item.source}</span>
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
          {item.thumbnailUrl && (
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
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="ainews-item-readmore"
            >
              {t('read_more')}
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

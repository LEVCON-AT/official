'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import type { AiNewsData } from './data';
import AiNewsItem from './AiNewsItem';

type Props = {
  archive: AiNewsData[];
  locale: string;
};

/**
 * Archive-Accordion for past AI News editions.
 * Initially collapsed, expands on click to show past editions.
 * Each edition shows date, summary, and items (using same AiNewsItem component).
 */
export default function AiNewsArchive({ archive, locale }: Props) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('ainews');

  if (archive.length === 0) return null;

  const dateFormat = locale === 'en' ? 'en-GB' : 'de-AT';
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  };

  return (
    <div className="ainews-archive">
      <button
        type="button"
        className="ainews-archive-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <ChevronRight
          className={`ainews-chevron${open ? ' is-open' : ''}`}
          size={14}
          aria-hidden="true"
        />
        <span className="ainews-archive-label">
          {open ? t('archive_hide') : t('archive_show')}
        </span>
        <span className="ainews-archive-count">{archive.length}</span>
      </button>

      {open && (
        <div className="ainews-archive-list">
          {archive.map((edition) => (
            <article key={edition.date.toISOString()} className="ainews-archive-edition">
              <h4 className="ainews-archive-date">
                {new Intl.DateTimeFormat(dateFormat, dateOptions).format(edition.date)}
              </h4>
              <p className="ainews-archive-summary">
                {locale === 'en' && edition.summaryEn
                  ? edition.summaryEn
                  : edition.summaryDe}
              </p>
              <div className="ainews-list">
                {edition.items.map((item) => (
                  <AiNewsItem key={item.id} item={item} locale={locale} />
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

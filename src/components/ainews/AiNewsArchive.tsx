'use client';

import { useState, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Search, X } from 'lucide-react';
import type { AiNewsData } from './data';
import AiNewsItem from './AiNewsItem';

type Props = {
  archive: AiNewsData[];
  locale: string;
};

const PAGE_SIZE = 5;
const MIN_CHARS_FOR_SEARCH = 2;

/**
 * Archive-Accordion for past AI News editions.
 * Initially collapsed, expands on click to show past editions.
 *
 * Features:
 * - Pagination: 5 editions visible initially, "load more" in 5er-steps
 * - "Show all" link for power users
 * - Search field: filters editions by keyword (headline, summary, source)
 * - Search matches across DE + EN + original headlines + descriptions
 */
export default function AiNewsArchive({ archive, locale }: Props) {
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('ainews');

  // Filter editions based on search query
  // Matches across: summary (DE+EN), item headlines (orig+DE+EN), descriptions, sources
  const filteredArchive = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < MIN_CHARS_FOR_SEARCH) return archive;

    return archive.filter((edition) => {
      // Search in daily summary
      const summaryDe = edition.summaryDe.toLowerCase();
      const summaryEn = (edition.summaryEn || '').toLowerCase();
      if (summaryDe.includes(query) || summaryEn.includes(query)) return true;

      // Search in items
      return edition.items.some((item) => {
        const haystack = [
          item.headline,
          item.headlineDe,
          item.headlineEn,
          item.descriptionDe,
          item.descriptionEn,
          item.source,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
    });
  }, [archive, searchQuery]);

  // Determine which editions to display
  const displayed = showAll ? filteredArchive : filteredArchive.slice(0, visibleCount);
  const hasMore = !showAll && visibleCount < filteredArchive.length;
  const remaining = filteredArchive.length - visibleCount;
  const isSearching = searchQuery.trim().length >= MIN_CHARS_FOR_SEARCH;

  // Update search query AND reset pagination to first page (avoids effect setState)
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setVisibleCount(PAGE_SIZE);
    setShowAll(false);
  };

  // Clear search handler
  const clearSearch = () => {
    handleSearchChange('');
    searchInputRef.current?.focus();
  };

  if (archive.length === 0) return null;

  const dateFormat = locale === 'en' ? 'en-GB' : 'de-AT';
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  };

  const searchPlaceholder = locale === 'en' ? 'Search archive…' : 'Archiv durchsuchen…';
  const loadMoreLabel = locale === 'en' ? 'Show earlier editions' : 'Frühere Ausgaben anzeigen';
  const showAllLabel = locale === 'en' ? `Show all ${filteredArchive.length} editions` : `Alle ${filteredArchive.length} Ausgaben anzeigen`;
  const showLessLabel = locale === 'en' ? 'Show less' : 'Weniger anzeigen';
  const remainingLabel = locale === 'en' ? `${remaining} more available` : `${remaining} weitere verfügbar`;
  const noResultsLabel = locale === 'en' ? 'No editions found.' : 'Keine Ausgaben gefunden.';
  const clearSearchLabel = locale === 'en' ? 'Clear search' : 'Suche zurücksetzen';

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
          {/* Search field */}
          <div className="ainews-archive-search" role="search">
            <Search
              className="ainews-archive-search-icon"
              size={14}
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              className="ainews-archive-search-input"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label={searchPlaceholder}
            />
            {searchQuery && (
              <button
                type="button"
                className="ainews-archive-search-clear"
                onClick={clearSearch}
                aria-label={clearSearchLabel}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Search result count (only when searching) */}
          {isSearching && (
            <p className="ainews-archive-search-info" role="status" aria-live="polite">
              {filteredArchive.length > 0
                ? (locale === 'en'
                    ? `${filteredArchive.length} edition${filteredArchive.length === 1 ? '' : 's'} found`
                    : `${filteredArchive.length} Ausgabe${filteredArchive.length === 1 ? '' : 'n'} gefunden`)
                : noResultsLabel}
            </p>
          )}

          {/* Editions */}
          {displayed.map((edition) => (
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

          {/* Load more / show all controls (hidden during search — show all matches) */}
          {!isSearching && filteredArchive.length > PAGE_SIZE && (
            <div className="ainews-archive-controls">
              {hasMore ? (
                <>
                  <button
                    type="button"
                    className="ainews-archive-loadmore"
                    onClick={() => setVisibleCount(visibleCount + PAGE_SIZE)}
                  >
                    {loadMoreLabel} ↓
                  </button>
                  <span className="ainews-archive-remaining">{remainingLabel}</span>
                  <button
                    type="button"
                    className="ainews-archive-showall"
                    onClick={() => setShowAll(true)}
                  >
                    {showAllLabel}
                  </button>
                </>
              ) : showAll ? (
                <button
                  type="button"
                  className="ainews-archive-showall"
                  onClick={() => {
                    setShowAll(false);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  {showLessLabel} ↑
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

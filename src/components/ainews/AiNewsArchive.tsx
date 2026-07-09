'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Search, X } from 'lucide-react';
import type { AiNewsData } from './data';
import AiNewsItem from './AiNewsItem';

type Props = {
  archive: AiNewsData[];
  locale: string;
};

const MIN_CHARS_FOR_SEARCH = 2;

/**
 * 3-stufiges Archiv-Accordion:
 *
 * Level 1: Haupt-Accordion (Archiv auf/zu)
 * Level 2: Monats-Navigation (← Juli 2026 →)
 * Level 3: Tages-Accordions (zugeklappt, klick → Items aufklappen)
 *
 * Suche: Filtert Editions UND Items innerhalb der Edition.
 */
export default function AiNewsArchive({ archive, locale }: Props) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('ainews');

  // ── Editions nach Monat gruppieren ────────────────────────────
  // Key: "YYYY-MM", Value: { label, editions[] }
  const months = useMemo(() => {
    const grouped = new Map<string, { key: string; label: string; editions: AiNewsData[] }>();

    for (const edition of archive) {
      const d = edition.date;
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      if (!grouped.has(key)) {
        const monthLabel = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-AT', {
          month: 'long',
          year: 'numeric',
        }).format(new Date(Date.UTC(year, month, 1)));
        grouped.set(key, { key, label: monthLabel, editions: [] });
      }
      grouped.get(key)!.editions.push(edition);
    }

    // Nach Datum absteigend sortieren (neuester Monat zuerst)
    return Array.from(grouped.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [archive, locale]);

  // ── Suche: Filtert Editions UND Items ─────────────────────────
  const filteredArchive = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < MIN_CHARS_FOR_SEARCH) return archive;

    return archive
      .map((edition) => {
        // 1. Match in Tages-Summary? → ganze Edition mit allen Items
        const summaryDe = edition.summaryDe.toLowerCase();
        const summaryEn = (edition.summaryEn || '').toLowerCase();
        if (summaryDe.includes(query) || summaryEn.includes(query)) {
          return edition;
        }

        // 2. Match in Items? → nur matchende Items behalten
        const matchedItems = edition.items.filter((item) => {
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

        if (matchedItems.length > 0) {
          return { ...edition, items: matchedItems };
        }
        return null;
      })
      .filter((edition): edition is AiNewsData => edition !== null);
  }, [archive, searchQuery]);

  // Gefilterte Monate (basierend auf filteredArchive)
  const filteredMonths = useMemo(() => {
    if (searchQuery.trim().length < MIN_CHARS_FOR_SEARCH) return months;

    const grouped = new Map<string, { key: string; label: string; editions: AiNewsData[] }>();
    for (const edition of filteredArchive) {
      const d = edition.date;
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      if (!grouped.has(key)) {
        const monthLabel = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-AT', {
          month: 'long',
          year: 'numeric',
        }).format(new Date(Date.UTC(year, month, 1)));
        grouped.set(key, { key, label: monthLabel, editions: [] });
      }
      grouped.get(key)!.editions.push(edition);
    }
    return Array.from(grouped.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [filteredArchive, months, searchQuery, locale]);

  // Reset month index when months change (z.B. bei Suche)
  const safeMonthIndex = Math.min(currentMonthIndex, Math.max(0, filteredMonths.length - 1));
  const currentMonth = filteredMonths[safeMonthIndex];

  const isSearching = searchQuery.trim().length >= MIN_CHARS_FOR_SEARCH;

  // ── Handlers ──────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentMonthIndex(0);
    setExpandedDays(new Set());
  };

  const clearSearch = () => {
    handleSearchChange('');
    searchInputRef.current?.focus();
  };

  const toggleDay = useCallback((dateKey: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  }, []);

  // Bei Suche: alle Tage automatisch aufklappen
  const effectiveExpandedDays = isSearching
    ? new Set(filteredArchive.map((e) => e.date.toISOString()))
    : expandedDays;

  if (archive.length === 0) return null;

  // ── Format helpers ────────────────────────────────────────────
  const dateFormat = locale === 'en' ? 'en-GB' : 'de-AT';
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  };
  const weekdayOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
  };

  // ── Labels ────────────────────────────────────────────────────
  const searchPlaceholder = locale === 'en' ? 'Search archive…' : 'Archiv durchsuchen…';
  const noResultsLabel = locale === 'en' ? 'No editions found.' : 'Keine Ausgaben gefunden.';
  const clearSearchLabel = locale === 'en' ? 'Clear search' : 'Suche zurücksetzen';
  const prevMonthLabel = locale === 'en' ? 'Previous month' : 'Voriger Monat';
  const nextMonthLabel = locale === 'en' ? 'Next month' : 'Nächster Monat';
  const postsLabel = locale === 'en' ? 'posts' : 'Beiträge';
  const editionCountLabel = (n: number) => locale === 'en'
    ? `${n} edition${n === 1 ? '' : 's'}`
    : `${n} Ausgabe${n === 1 ? '' : 'n'}`;

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

          {/* Search result count */}
          {isSearching && (
            <p className="ainews-archive-search-info" role="status" aria-live="polite">
              {filteredArchive.length > 0
                ? editionCountLabel(filteredArchive.length)
                : noResultsLabel}
            </p>
          )}

          {/* No results — exit */}
          {filteredArchive.length === 0 && (
            <div className="ainews-archive-empty" />
          )}

          {/* Monate + Tage */}
          {filteredArchive.length > 0 && currentMonth && (
            <>
              {/* Monats-Navigation */}
              {filteredMonths.length > 1 && (
                <div className="ainews-archive-monthnav" role="navigation" aria-label={locale === 'en' ? 'Month navigation' : 'Monats-Navigation'}>
                  <button
                    type="button"
                    className="ainews-archive-monthnav-btn"
                    onClick={() => setCurrentMonthIndex(Math.min(safeMonthIndex + 1, filteredMonths.length - 1))}
                    disabled={safeMonthIndex >= filteredMonths.length - 1}
                    aria-label={prevMonthLabel}
                  >
                    ←
                  </button>
                  <span className="ainews-archive-monthnav-label">
                    {currentMonth.label}
                    <span className="ainews-archive-monthnav-count">
                      {editionCountLabel(currentMonth.editions.length)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="ainews-archive-monthnav-btn"
                    onClick={() => setCurrentMonthIndex(Math.max(safeMonthIndex - 1, 0))}
                    disabled={safeMonthIndex <= 0}
                    aria-label={nextMonthLabel}
                  >
                    →
                  </button>
                </div>
              )}

              {/* Einzelner Monat ohne Navigation */}
              {filteredMonths.length === 1 && (
                <div className="ainews-archive-monthnav-single">
                  <span className="ainews-archive-monthnav-label">
                    {currentMonth.label}
                    <span className="ainews-archive-monthnav-count">
                      {editionCountLabel(currentMonth.editions.length)}
                    </span>
                  </span>
                </div>
              )}

              {/* Tages-Accordions */}
              <div className="ainews-archive-days">
                {currentMonth.editions.map((edition) => {
                  const dateKey = edition.date.toISOString();
                  const isDayExpanded = effectiveExpandedDays.has(dateKey);
                  const itemLabel = `${edition.items.length} ${postsLabel}`;
                  const formattedDate = new Intl.DateTimeFormat(dateFormat, dateOptions).format(edition.date);
                  const weekday = new Intl.DateTimeFormat(dateFormat, weekdayOptions).format(edition.date);

                  return (
                    <article key={dateKey} className="ainews-archive-day">
                      <button
                        type="button"
                        className="ainews-archive-day-toggle"
                        onClick={() => toggleDay(dateKey)}
                        aria-expanded={isDayExpanded}
                      >
                        <ChevronRight
                          className={`ainews-chevron${isDayExpanded ? ' is-open' : ''}`}
                          size={12}
                          aria-hidden="true"
                        />
                        <span className="ainews-archive-day-weekday">{weekday}</span>
                        <span className="ainews-archive-day-date">{formattedDate}</span>
                        <span className="ainews-archive-day-count">{itemLabel}</span>
                      </button>

                      {isDayExpanded && (
                        <div className="ainews-archive-day-body">
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
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

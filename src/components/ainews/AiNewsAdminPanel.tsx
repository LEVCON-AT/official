'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * AiNewsAdminPanel — Quality-Gate Monitoring für Owner
 *
 * Wird auf /ai-news?admin=<token> eingeblendet (token == LEVCON_INTERNAL_API_KEY).
 * Holt die Quality-Stats der letzten 14 Tage von /api/ai-news/quality-report
 * und zeigt sie als kompakte Tabelle + Detail-Accordion an.
 *
 * Features:
 *  - Summary-Cards: Success Rate, Avg Items, Retries, Warnings, Fallbacks
 *  - Per-Day-Tabelle mit Status-Icon, Item-Counts, Retry-Count, Warnings
 *  - Detail-Accordion pro Tag (Warnings + Errors als Liste)
 *  - Manual Refresh Button
 *  - Auto-Refresh alle 5 Minuten
 *  - Loading + Error States
 *
 * Standards (per QUALITY-GUIDELINES.md):
 *  - Semantic HTML (section, article, h2/h3, ul/li)
 *  - ARIA 1.2 (aria-label, aria-expanded, role="alert" bei Errors)
 *  - WCAG 2.1 AA (Touch-Targets ≥44px, Focus-Visible, Contrast)
 *  - TypeScript strict (kein any)
 *  - 'use client' da interaktiv
 */

type QualityDay = {
  date: string;
  runAt: string;
  status: 'success' | 'partial' | 'error' | 'skipped' | string;
  itemCount: number;
  itemCountDe: number;
  itemCountEn: number;
  retryCount: number;
  warningCount: number;
  fallbackUsed: string;
  warnings: string[];
  errors: string[];
  errorMessage: string | null;
};

type QualitySummary = {
  totalRuns: number;
  successRuns: number;
  partialRuns: number;
  errorRuns: number;
  successRate: number;
  totalRetries: number;
  totalWarnings: number;
  fallbackUsedCount: number;
  avgItemCount: number;
  avgItemCountDe: number;
  avgItemCountEn: number;
  daysCovered: number;
};

type QualityReport = {
  summary: QualitySummary;
  days: QualityDay[];
  generatedAt: string;
};

type Props = {
  adminToken: string;
  locale: string;
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes auto-refresh

export default function AiNewsAdminPanel({ adminToken, locale }: Props) {
  const t = useTranslations('ainews.admin');
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-news/quality-report?days=14&admin=${encodeURIComponent(adminToken)}`);
      if (!res.ok) {
        if (res.status === 401) {
          setError(t('error_unauthorized'));
        } else {
          setError(`${t('error_fetch')} (HTTP ${res.status})`);
        }
        return;
      }
      const data: QualityReport = await res.json();
      setReport(data);
      setLastFetch(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_unknown'));
    } finally {
      setLoading(false);
    }
  }, [adminToken, t]);

  // Initial fetch
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchReport, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchReport]);

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  // ── Status icon helper ────────────────────────────────────────
  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'success') {
      return <CheckCircle2 size={14} className="admin-status-icon admin-status-success" aria-hidden="true" />;
    }
    if (status === 'partial') {
      return <AlertCircle size={14} className="admin-status-icon admin-status-partial" aria-hidden="true" />;
    }
    if (status === 'error') {
      return <XCircle size={14} className="admin-status-icon admin-status-error" aria-hidden="true" />;
    }
    return <AlertCircle size={14} className="admin-status-icon admin-status-skipped" aria-hidden="true" />;
  };

  // ── Loading state ─────────────────────────────────────────────
  if (loading && !report) {
    return (
      <section className="ainews-admin" aria-label={t('title')}>
        <div className="ainews-admin-header">
          <h2 className="ainews-admin-title">{t('title')}</h2>
          <RefreshCw size={14} className="admin-spin" aria-hidden="true" />
        </div>
        <p className="ainews-admin-loading">{t('loading')}</p>
      </section>
    );
  }

  // ── Error state ───────────────────────────────────────────────
  if (error) {
    return (
      <section className="ainews-admin" aria-label={t('title')}>
        <div className="ainews-admin-header">
          <h2 className="ainews-admin-title">{t('title')}</h2>
          <button
            type="button"
            className="admin-refresh-btn"
            onClick={fetchReport}
            aria-label={t('refresh')}
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="ainews-admin-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      </section>
    );
  }

  if (!report) return null;

  const { summary, days } = report;
  const successRatePercent = Math.round(summary.successRate * 100);

  return (
    <section className="ainews-admin" aria-label={t('title')}>
      <div className="ainews-admin-header">
        <h2 className="ainews-admin-title">{t('title')}</h2>
        <div className="ainews-admin-actions">
          {lastFetch && (
            <span className="ainews-admin-lastfetch">
              {t('last_fetch')}: {lastFetch.toLocaleTimeString(locale === 'en' ? 'en-GB' : 'de-AT')}
            </span>
          )}
          <button
            type="button"
            className="admin-refresh-btn"
            onClick={fetchReport}
            aria-label={t('refresh')}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'admin-spin' : ''} aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="ainews-admin-lead">{t('lead')}</p>

      {/* ── Summary Cards ─────────────────────────────────────── */}
      <div className="admin-summary-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-label">{t('stat_success_rate')}</div>
          <div className={`admin-stat-value ${successRatePercent >= 80 ? 'is-ok' : successRatePercent >= 60 ? 'is-warn' : 'is-bad'}`}>
            {successRatePercent}%
          </div>
          <div className="admin-stat-sub">
            {summary.successRuns}/{summary.totalRuns} {t('stat_runs')}
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-label">{t('stat_avg_items')}</div>
          <div className="admin-stat-value">{summary.avgItemCount}</div>
          <div className="admin-stat-sub">
            DE: {summary.avgItemCountDe} · EN: {summary.avgItemCountEn}
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-label">{t('stat_retries')}</div>
          <div className={`admin-stat-value ${summary.totalRetries === 0 ? 'is-ok' : 'is-warn'}`}>
            {summary.totalRetries}
          </div>
          <div className="admin-stat-sub">{t('stat_retries_sub')}</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-label">{t('stat_warnings')}</div>
          <div className={`admin-stat-value ${summary.totalWarnings === 0 ? 'is-ok' : 'is-warn'}`}>
            {summary.totalWarnings}
          </div>
          <div className="admin-stat-sub">{t('stat_warnings_sub')}</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-label">{t('stat_fallbacks')}</div>
          <div className={`admin-stat-value ${summary.fallbackUsedCount === 0 ? 'is-ok' : 'is-bad'}`}>
            {summary.fallbackUsedCount}
          </div>
          <div className="admin-stat-sub">{t('stat_fallbacks_sub')}</div>
        </div>
      </div>

      {/* ── Per-Day Table ─────────────────────────────────────── */}
      <h3 className="admin-section-title">{t('per_day_title')}</h3>

      {days.length === 0 ? (
        <p className="admin-empty">{t('no_runs')}</p>
      ) : (
        <ul className="admin-day-list">
          {days.map((day) => {
            const isExpanded = expandedDays.has(day.date);
            const hasDetails = day.warnings.length > 0 || day.errors.length > 0 || day.errorMessage;
            const dateObj = new Date(day.runAt);
            const dateLabel = dateObj.toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-AT', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            const timeLabel = dateObj.toLocaleTimeString(locale === 'en' ? 'en-GB' : 'de-AT', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <li key={day.date} className={`admin-day-item admin-day-${day.status}`}>
                <button
                  type="button"
                  className="admin-day-toggle"
                  onClick={() => hasDetails && toggleDay(day.date)}
                  aria-expanded={isExpanded}
                  aria-disabled={!hasDetails}
                >
                  <StatusIcon status={day.status} />
                  <span className="admin-day-date">{dateLabel}</span>
                  <span className="admin-day-time">{timeLabel}</span>
                  <span className="admin-day-status">{t(`status_${day.status}`)}</span>
                  <span className="admin-day-counts">
                    <span className="admin-count-pill" title={t('items_total')}>
                      {day.itemCount}
                    </span>
                    <span className="admin-count-pill admin-count-de" title="DE">
                      DE {day.itemCountDe}
                    </span>
                    <span className="admin-count-pill admin-count-en" title="EN">
                      EN {day.itemCountEn}
                    </span>
                    {day.retryCount > 0 && (
                      <span className="admin-count-pill admin-count-retry" title={t('retries')}>
                        ↻ {day.retryCount}
                      </span>
                    )}
                    {day.warningCount > 0 && (
                      <span className="admin-count-pill admin-count-warn" title={t('warnings')}>
                        ⚠ {day.warningCount}
                      </span>
                    )}
                    {day.fallbackUsed !== 'none' && (
                      <span className="admin-count-pill admin-count-fallback" title={t('fallback')}>
                        ⟲ {t(`fallback_${day.fallbackUsed}`)}
                      </span>
                    )}
                  </span>
                  {hasDetails && (
                    <span className="admin-day-chevron" aria-hidden="true">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  )}
                </button>

                {isExpanded && hasDetails && (
                  <div className="admin-day-details">
                    {day.errorMessage && (
                      <div className="admin-detail-block admin-detail-error">
                        <strong>{t('error_message')}:</strong>
                        <code>{day.errorMessage}</code>
                      </div>
                    )}
                    {day.errors.length > 0 && (
                      <div className="admin-detail-block admin-detail-errors">
                        <strong>{t('errors')} ({day.errors.length}):</strong>
                        <ul>
                          {day.errors.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {day.warnings.length > 0 && (
                      <div className="admin-detail-block admin-detail-warnings">
                        <strong>{t('warnings')} ({day.warnings.length}):</strong>
                        <ul>
                          {day.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="admin-footer-note">
        {t('footer_note')} · {t('auto_refresh')}
      </p>
    </section>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { NEWS_LANGUAGES } from './languages';

type SubscriberData = {
  id: number;
  email: string;
  language: string;
  newsLanguages: string;
  frequency: string;
  confirmedAt: string | null;
};

type Props = {
  token: string;
  locale: string;
  onUpdated: () => void;
};

export default function AiNewsSettings({ token, locale, onUpdated }: Props) {
  const [subscriber, setSubscriber] = useState<SubscriberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Form state
  const [language, setLanguage] = useState('de');
  const [frequency, setFrequency] = useState('daily');
  const [newsLangs, setNewsLangs] = useState<Set<string>>(new Set(['de', 'en']));
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  // Refs for click-outside + scroll
  const dropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Fetch subscriber data
  useEffect(() => {
    async function fetchSubscriber() {
      try {
        const res = await fetch(`/api/ai-news/subscriber?token=${token}`);
        if (!res.ok) {
          setError(locale === 'de' ? 'Abonnement nicht gefunden.' : 'Subscription not found.');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setSubscriber(data.subscriber);
        setLanguage(data.subscriber.language);
        setFrequency(data.subscriber.frequency);
        setNewsLangs(new Set(data.subscriber.newsLanguages.split(',')));
      } catch {
        setError(locale === 'de' ? 'Fehler beim Laden.' : 'Error loading data.');
      }
      setLoading(false);
    }
    fetchSubscriber();
  }, [token, locale]);

  // Click-outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
      }
    }
    if (langDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [langDropdownOpen]);

  // Scroll to settings after load
  useEffect(() => {
    if (!loading && subscriber && settingsRef.current) {
      setTimeout(() => {
        settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [loading, subscriber]);

  const toggleNewsLang = (lang: string) => {
    setNewsLangs(prev => {
      const next = new Set(prev);
      if (next.has(lang)) {
        if (next.size > 1) next.delete(lang);
      } else {
        next.add(lang);
      }
      return next;
    });
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch(`/api/ai-news/subscriber?token=${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          frequency,
          newsLanguages: Array.from(newsLangs).join(','),
        }),
      });

      if (res.ok) {
        setSaved(true);
        onUpdated();
      } else {
        setError(locale === 'de' ? 'Speichern fehlgeschlagen.' : 'Save failed.');
      }
    } catch {
      setError(locale === 'de' ? 'Netzwerkfehler.' : 'Network error.');
    }
    setSaving(false);
  }, [token, language, frequency, newsLangs, locale, onUpdated]);

  if (loading) {
    return (
      <div className="ainews-settings-loading">
        <Loader2 size={16} className="ainews-settings-spinner" aria-hidden="true" />
        <span>{locale === 'de' ? 'Laden…' : 'Loading…'}</span>
      </div>
    );
  }

  if (error && !subscriber) {
    return (
      <div className="ainews-settings-error">
        <p>{error}</p>
      </div>
    );
  }

  if (!subscriber) return null;

  const selectedLangsDisplay = NEWS_LANGUAGES
    .filter(l => newsLangs.has(l.code))
    .map(l => l.shortLabel)
    .join(', ');

  return (
    <div className="ainews-settings" ref={settingsRef}>
      <h3 className="ainews-settings-title">
        {locale === 'de' ? 'Einstellungen' : 'Settings'}
      </h3>
      <p className="ainews-settings-email">{subscriber.email}</p>

      <div className="ainews-settings-form">
        {/* Newsletter language */}
        <div className="ainews-form-group">
          <label className="form-label" htmlFor="settings-language">
            {locale === 'de' ? 'Newsletter-Sprache' : 'Newsletter Language'}
          </label>
          <select
            id="settings-language"
            className="form-input ainews-settings-select"
            value={language}
            onChange={(e) => { setLanguage(e.target.value); setSaved(false); }}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Frequency */}
        <fieldset className="ainews-form-group">
          <legend className="form-label">
            {locale === 'de' ? 'Frequenz' : 'Frequency'}
          </legend>
          <div className="ainews-frequency-options">
            {(['daily', 'weekly', 'digest'] as const).map(freq => (
              <label
                key={freq}
                className={`ainews-frequency-option${frequency === freq ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name="settings-frequency"
                  value={freq}
                  checked={frequency === freq}
                  onChange={() => { setFrequency(freq); setSaved(false); }}
                  className="ainews-frequency-input"
                />
                <span className="ainews-frequency-label">{freq === 'daily' ? (locale === 'de' ? 'Täglich' : 'Daily') : freq === 'weekly' ? (locale === 'de' ? 'Wöchentlich' : 'Weekly') : (locale === 'de' ? 'Monatlich' : 'Monthly')}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* News languages dropdown */}
        <fieldset className="ainews-form-group">
          <legend className="form-label">
            {locale === 'de' ? 'News-Sprachen' : 'News Languages'}
          </legend>
          <div className="ainews-lang-dropdown-wrapper" ref={dropdownRef}>
            <button
              type="button"
              className="ainews-lang-dropdown-trigger"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              aria-expanded={langDropdownOpen}
              aria-haspopup="listbox"
            >
              <span className="ainews-lang-dropdown-value">
                {selectedLangsDisplay || (locale === 'de' ? 'Sprachen wählen' : 'Select languages')}
              </span>
              <ChevronDown
                size={14}
                className={`ainews-lang-dropdown-chevron${langDropdownOpen ? ' is-open' : ''}`}
                aria-hidden="true"
              />
            </button>
            {langDropdownOpen && (
              <div className="ainews-lang-dropdown-menu ainews-lang-dropdown-up" role="listbox" aria-multiselectable="true">
                {NEWS_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    role="option"
                    aria-selected={newsLangs.has(lang.code)}
                    className={`ainews-lang-dropdown-item${newsLangs.has(lang.code) ? ' selected' : ''}`}
                    onClick={() => toggleNewsLang(lang.code)}
                    dir={lang.rtl ? 'rtl' : 'ltr'}
                  >
                    <span className="ainews-lang-dropdown-check">
                      {newsLangs.has(lang.code) && <Check size={12} aria-hidden="true" />}
                    </span>
                    <span className="ainews-lang-dropdown-label">{lang.label}</span>
                    <span className="ainews-lang-dropdown-native">{lang.nativeName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="ainews-news-lang-hint">
            {locale === 'de'
              ? 'Welche Sprachen sollen im Newsletter enthalten sein?'
              : 'Which languages should be included in the newsletter?'}
          </p>
        </fieldset>

        {/* Save button */}
        <button
          className="form-submit ainews-signup-submit"
          type="button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (locale === 'de' ? 'Speichern…' : 'Saving…') : (locale === 'de' ? 'Speichern' : 'Save')}
        </button>

        {saved && (
          <div className="form-status success" role="status">
            {locale === 'de' ? 'Einstellungen gespeichert.' : 'Settings saved.'}
          </div>
        )}
        {error && (
          <div className="form-status error" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

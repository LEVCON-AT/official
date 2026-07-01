'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';

type Frequency = 'daily' | 'weekly' | 'digest';

type Props = {
  locale: string;
  onOpenPrivacy: () => void;
};

export default function AiNewsSignup({ locale, onOpenPrivacy }: Props) {
  const t = useTranslations('ainews.signup');
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; consent?: string; frequency?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const formLoadTime = useRef<number>(Date.now());

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Honeypot — bots fill this, humans don't
    if (formData.get('website')) {
      return; // silently ignore
    }

    // Time check — submitted too fast = bot
    if (Date.now() - formLoadTime.current < 2500) {
      return;
    }

    const newErrors: { email?: string; consent?: string; frequency?: string } = {};

    if (!email.trim()) {
      newErrors.email = t('error_required_email');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = t('error_invalid_email');
    }

    if (!consent) {
      newErrors.consent = t('error_required_consent');
    }

    if (!frequency) {
      newErrors.frequency = t('error_required_frequency');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch('/api/ai-news/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          frequency,
          language: locale,
        }),
      });

      if (res.ok) {
        setStatus('success');
        setEmail('');
        setConsent(false);
        setFrequency('daily');
      } else if (res.status === 409) {
        setErrors({ email: t('error_exists') });
      } else if (res.status === 429) {
        setErrors({ email: t('error_spam') });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  }, [email, consent, frequency, locale, t]);

  if (status === 'success') {
    return (
      <div className="ainews-signup ainews-signup-success" role="status" aria-live="polite">
        <h3 className="ainews-signup-title">{t('success_title')}</h3>
        <p className="ainews-signup-body">{t('success_body')}</p>
      </div>
    );
  }

  return (
    <div className="ainews-signup">
      <div className="ainews-signup-header">
        <Mail size={14} aria-hidden="true" />
        <h3 className="ainews-signup-title">{t('title')}</h3>
      </div>
      <p className="ainews-signup-lead">{t('lead')}</p>

      <form className="ainews-signup-form" onSubmit={handleSubmit} noValidate>
        {/* Honeypot — hidden from humans */}
        <div className="form-hp" aria-hidden="true">
          <label htmlFor="ainews-website">Website</label>
          <input
            type="text"
            id="ainews-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div className="ainews-form-group">
          <label className="form-label" htmlFor="ainews-email">
            {t('email_label')} *
          </label>
          <input
            className="form-input"
            type="email"
            id="ainews-email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'ainews-email-error' : undefined}
          />
          {errors.email && (
            <div id="ainews-email-error" className="form-field-error" role="alert">
              {errors.email}
            </div>
          )}
        </div>

        <fieldset className="ainews-form-group">
          <legend className="form-label">{t('frequency_label')} *</legend>
          <div className="ainews-frequency-options">
            {(['daily', 'weekly', 'digest'] as const).map((freq) => (
              <label
                key={freq}
                className={`ainews-frequency-option${frequency === freq ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name="frequency"
                  value={freq}
                  checked={frequency === freq}
                  onChange={() => setFrequency(freq)}
                  className="ainews-frequency-input"
                />
                <span className="ainews-frequency-label">{t(freq)}</span>
                <span className="ainews-frequency-desc">{t(`${freq}_desc`)}</span>
              </label>
            ))}
          </div>
          {errors.frequency && (
            <div className="form-field-error" role="alert">
              {errors.frequency}
            </div>
          )}
        </fieldset>

        <div className="form-checkbox-row">
          <input
            className="form-checkbox"
            type="checkbox"
            id="ainews-consent"
            name="consent"
            required
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              setErrors((prev) => ({ ...prev, consent: undefined }));
            }}
            aria-invalid={!!errors.consent}
          />
          <label className="form-checkbox-label" htmlFor="ainews-consent">
            {locale === 'de' ? (
              <>
                {t('consent').split('Datenschutzerklärung')[0]}
                <button
                  type="button"
                  className="inline-link"
                  onClick={onOpenPrivacy}
                >
                  {t('consent_link')}
                </button>
                {t('consent').split('Datenschutzerklärung')[1]}
              </>
            ) : (
              <>
                {t('consent').split('Privacy Policy')[0]}
                <button
                  type="button"
                  className="inline-link"
                  onClick={onOpenPrivacy}
                >
                  {t('consent_link')}
                </button>
                {t('consent').split('Privacy Policy')[1]}
              </>
            )}
          </label>
        </div>
        {errors.consent && (
          <div className="form-field-error" role="alert">
            {errors.consent}
          </div>
        )}

        <button
          className="form-submit ainews-signup-submit"
          type="submit"
          disabled={submitting}
        >
          {submitting ? t('submitting') : t('submit')}
        </button>

        {status === 'error' && (
          <div className="form-status error" role="alert">
            {t('error_generic')}
          </div>
        )}
      </form>
    </div>
  );
}

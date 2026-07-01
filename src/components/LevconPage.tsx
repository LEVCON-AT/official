'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations, useMessages } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import AiNewsItem, { type AiNewsItemType } from '@/components/ainews/AiNewsItem';
import AiNewsSignup from '@/components/ainews/AiNewsSignup';
import AiNewsArchive from '@/components/ainews/AiNewsArchive';
import type { AiNewsData } from '@/components/ainews/data';

type PanelId = 'schulungen' | 'framework' | 'privacy' | 'ainews' | 'faq' | 'kontakt' | 'impressum' | 'datenschutz';

const FADE_MS = 320;

type LevconPageProps = {
  locale: string;
  todaysNews: AiNewsData | null;
  archivedNews: AiNewsData[];
};

export default function LevconPage({ locale, todaysNews, archivedNews }: LevconPageProps) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [introHiding, setIntroHiding] = useState(false);
  const [introGone, setIntroGone] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formLoadTime = useRef<number>(Date.now());

  // Contact form state
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formConsent, setFormConsent] = useState(false);
  const [formSending, setFormSending] = useState(false);
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; consent?: string }>({});

  const t = useTranslations();
  const messages = useMessages() as Record<string, unknown>;
  const pathname = usePathname();

  // Raw HTML content (bypasses next-intl ICU parsing)
  const impressumHtml = (messages.impressum as Record<string, string>).body;
  const datenschutzHtml = (messages.datenschutz as Record<string, string>).body;
  const datenschutzTitleShy = (messages.datenschutz as Record<string, string>).title_shy;

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  // Handle browser back/forward — reset to home state
  useEffect(() => {
    const handlePopState = () => {
      setActivePanel(null);
      setIntroHiding(false);
      setIntroGone(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleFormSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors: { name?: string; email?: string; consent?: string } = {};

    // Honeypot check
    const formData = new FormData(e.currentTarget);
    if (formData.get('website')) return; // Bot filled the honeypot

    // Time check — form submitted in under 2 seconds = likely bot
    if (Date.now() - formLoadTime.current < 2000) return;

    // Validation
    if (!formName.trim()) errors.name = t('kontakt.form_name_required');
    if (!formEmail.trim()) errors.email = t('kontakt.form_email_required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) errors.email = t('kontakt.form_email_invalid');
    if (!formConsent) errors.consent = t('kontakt.form_consent_required');

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormSending(true);
    setFormErrors({});

    try {
      const res = await fetch('/api/contact?XTransformPort=3000', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), email: formEmail.trim(), message: formMessage.trim() }),
      });

      if (res.ok) {
        setFormStatus({ type: 'success', message: t('kontakt.form_success') });
        setFormName('');
        setFormEmail('');
        setFormMessage('');
        setFormConsent(false);
      } else {
        setFormStatus({ type: 'error', message: t('kontakt.form_error') });
      }
    } catch {
      setFormStatus({ type: 'error', message: t('kontakt.form_error') });
    } finally {
      setFormSending(false);
    }
  }, [formName, formEmail, formMessage, formConsent, t]);

  const goHome = useCallback(() => {
    setActivePanel(null);
    setIntroHiding(false);
    setIntroGone(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openPanel = useCallback((target: PanelId) => {
    if (activePanel === target) {
      goHome();
      return;
    }

    // If intro is visible, fade it out first then show panel
    if (!introGone) {
      setIntroHiding(true);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => {
        setIntroGone(true);
        setActivePanel(target);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, FADE_MS);
    } else {
      setActivePanel(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activePanel, introGone, goHome]);

  const handleNavClick = useCallback((target: string) => {
    if (target === 'home') {
      goHome();
      return;
    }
    openPanel(target as PanelId);
  }, [goHome, openPanel]);

  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    goHome();
  }, [goHome]);

  const schulungItems = t.raw('schulungen.items') as Array<{
    audience: string;
    format: string;
    outcome: string;
    topics: string[];
  }>;

  const frameworkSteps = t.raw('framework.steps') as Array<{
    letter: string;
    title: string;
    paragraphs: string[];
  }>;

  const frameworkMetrics = t.raw('framework.metrics') as string[];

  const privacyTiers = t.raw('privacy.tiers') as Array<{
    num: string;
    name: string;
    desc: string;
  }>;

  const faqItems = t.raw('faq.items') as Array<{
    q: string;
    a: string;
  }>;

  const aboutBody = t.raw('about.body') as string[];

  const introClass = [
    'intro-wrap',
    introHiding ? 'is-hiding' : '',
    introGone ? 'is-gone' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="levcon-body">
      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: `
<!--
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   You're reading the source code. We appreciate that.            ║
║                                                                  ║
║   This website was crafted with care — and with the help of AI.  ║
║   Every line was reviewed, refined, and approved by a human      ║
║   who cares deeply about quality, accessibility and craft.       ║
║                                                                  ║
║   If you're the kind of person who inspects source code,         ║
║   you're exactly the kind of person we'd love to work with.      ║
║                                                                  ║
║   Want a website like this — clean, fast, and built with         ║
║   intention? Let's talk.                                         ║
║                                                                  ║
║   hello@levcon.ai · levcon.ai                                    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
-->
` }} />
      {/* Skip Navigation */}
      <a href="#main-content" className="skip-nav">
        {locale === 'de' ? 'Zum Inhalt springen' : 'Skip to content'}
      </a>

      {/* ── HEADER ────────────────────────────── */}
      <header className="levcon-header">
        <a className="logo-mark" href="/" onClick={handleLogoClick} aria-label={t('header.logo_aria_label')}>
          <span className="logo-wordmark">Levcon<span className="logo-ai">.AI</span></span>
        </a>

        <h1 className="site-slogan">
          <span>{t('header.slogan_line1')}</span><span className="red">.</span><br />
          <span>{t('header.slogan_line2')}</span><span className="red">.</span>
        </h1>

        <p className="divider-line">
          <span className="divider-rule" aria-hidden="true" />
          <span className="divider-text">{t('header.divider')}</span>
          <span className="divider-rule" aria-hidden="true" />
        </p>

        <nav aria-label={locale === 'de' ? 'Seitennavigation' : 'Page navigation'}>
          <button
            className={`nav-btn${activePanel === null ? ' active' : ''}`}
            onClick={() => handleNavClick('home')}
          >
            {t('header.nav_home')}
          </button>
          <span className="nav-sep" aria-hidden="true">/</span>
          <button
            className={`nav-btn${activePanel === 'schulungen' ? ' active' : ''}`}
            onClick={() => handleNavClick('schulungen')}
            aria-expanded={activePanel === 'schulungen'}
          >
            {t('header.nav_schulungen')}
          </button>
          <span className="nav-sep" aria-hidden="true">/</span>
          <button
            className={`nav-btn${activePanel === 'framework' ? ' active' : ''}`}
            onClick={() => handleNavClick('framework')}
            aria-expanded={activePanel === 'framework'}
          >
            {t('header.nav_framework')}
          </button>
          <span className="nav-sep" aria-hidden="true">/</span>
          <button
            className={`nav-btn${activePanel === 'privacy' ? ' active' : ''}`}
            onClick={() => handleNavClick('privacy')}
            aria-expanded={activePanel === 'privacy'}
          >
            {t('header.nav_privacy')}
          </button>
          <span className="nav-sep" aria-hidden="true">/</span>
          <button
            className={`nav-btn${activePanel === 'ainews' ? ' active' : ''}`}
            onClick={() => handleNavClick('ainews')}
            aria-expanded={activePanel === 'ainews'}
          >
            {t('header.nav_ainews')}
          </button>
          <span className="nav-sep" aria-hidden="true">/</span>
          <button
            className={`nav-btn${activePanel === 'faq' ? ' active' : ''}`}
            onClick={() => handleNavClick('faq')}
            aria-expanded={activePanel === 'faq'}
          >
            {t('header.nav_faq')}
          </button>
          <span className="nav-sep" aria-hidden="true">/</span>
          <button
            className={`nav-btn${activePanel === 'kontakt' ? ' active' : ''}`}
            onClick={() => handleNavClick('kontakt')}
            aria-expanded={activePanel === 'kontakt'}
          >
            {t('header.nav_kontakt')}
          </button>
        </nav>
      </header>

      {/* ── MAIN ──────────────────────────────── */}
      <main id="main-content" className="levcon-main">

        {/* Intro / About */}
        <div className={introClass}>
          <section className="about" aria-label={locale === 'de' ? 'Über Levcon.ai' : 'About Levcon.ai'}>
            <div className="about-grid">
              <div className="about-statement">{t('about.statement')}</div>
              <div className="about-body">
                {aboutBody.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* KI Schulungen */}
        <section
          className={`panel${activePanel === 'schulungen' ? ' open' : ''}`}
          id="schulungen"
          aria-hidden={activePanel !== 'schulungen'}
        >
          <div className="panel-inner"><div className="panel-content">
            <h2 className="panel-title">{t('schulungen.title')}</h2>
            <p className="panel-lead">{t('schulungen.lead')}</p>
            <ul className="schulung-list">
              {schulungItems.map((item, i) => (
                <li key={i} className="schulung-item">
                  <div className="schulung-header">
                    <span className="schulung-audience">{item.audience}</span>
                    <span className="schulung-format">{item.format}</span>
                  </div>
                  <div className="schulung-outcome">{item.outcome}</div>
                  <div className="schulung-topics">
                    {item.topics.map((topic, j) => (
                      <span key={j} className="schulung-tag">{topic}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div></div>
        </section>

        {/* Framework */}
        <section
          className={`panel${activePanel === 'framework' ? ' open' : ''}`}
          id="framework"
          aria-hidden={activePanel !== 'framework'}
        >
          <div className="panel-inner"><div className="panel-content">
            <h2 className="panel-title">{t('framework.title')}</h2>
            <p className="panel-lead">{t('framework.lead')}</p>
            <ul className="framework-list">
              {frameworkSteps.map((step, i) => (
                <li key={i} className="framework-step">
                  <span className="step-letter">{step.letter}</span>
                  <div className="step-body">
                    <h3>{step.title}</h3>
                    {step.paragraphs.map((p, j) => (
                      <p key={j}>{p}</p>
                    ))}
                    {i === frameworkSteps.length - 1 && (
                      <div className="metric-row">
                        {frameworkMetrics.map((m, j) => (
                          <span key={j} className="metric-chip">{m}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div></div>
        </section>

        {/* Datenschutz-Modell */}
        <section
          className={`panel${activePanel === 'privacy' ? ' open' : ''}`}
          id="privacy"
          aria-hidden={activePanel !== 'privacy'}
        >
          <div className="panel-inner"><div className="panel-content">
            <h2 className="panel-title">{t('privacy.title')}</h2>
            <p className="panel-lead">{t('privacy.lead')}</p>
            <p className="panel-lead tier-closing">{t('privacy.closing')}</p>
            <div className="tier-grid">
              {privacyTiers.map((tier, i) => (
                <div key={i} className="tier-card">
                  <div className="tier-num">{tier.num}</div>
                  <div className="tier-name">{tier.name}</div>
                  <div className="tier-desc">{tier.desc}</div>
                </div>
              ))}
            </div>
          </div></div>
        </section>

        {/* AI News */}
        <section
          className={`panel${activePanel === 'ainews' ? ' open' : ''}`}
          id="ainews"
          aria-hidden={activePanel !== 'ainews'}
        >
          <div className="panel-inner"><div className="panel-content">
            <h2 className="panel-title">{t('ainews.title')}</h2>
            <p className="panel-lead">{t('ainews.lead')}</p>

            {todaysNews ? (
              <>
                <div className="ainews-summary">
                  <div className="ainews-summary-date">
                    {t('ainews.today_label')} ·{' '}
                    {new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-AT', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    }).format(todaysNews.date)}
                  </div>
                  <p className="ainews-summary-text">
                    {locale === 'en' && todaysNews.summaryEn
                      ? todaysNews.summaryEn
                      : todaysNews.summaryDe}
                  </p>
                </div>

                <div className="ainews-list">
                  {todaysNews.items.map((item: AiNewsItemType) => (
                    <AiNewsItem key={item.id} item={item} locale={locale} />
                  ))}
                </div>
              </>
            ) : (
              <p className="ainews-empty">{t('ainews.no_news_today')}</p>
            )}

            <AiNewsArchive archive={archivedNews} locale={locale} />

            <AiNewsSignup locale={locale} onOpenPrivacy={() => openPanel('datenschutz')} />
          </div></div>
        </section>

        {/* FAQ */}
        <section
          className={`panel${activePanel === 'faq' ? ' open' : ''}`}
          id="faq"
          aria-hidden={activePanel !== 'faq'}
        >
          <div className="panel-inner"><div className="panel-content">
            <h2 className="panel-title">{t('faq.title')}</h2>
            <p className="panel-lead">{t('faq.lead')}</p>
            <ul className="faq-list">
              {faqItems.map((item, i) => (
                <li key={i} className="faq-item">
                  <div className="faq-q">{item.q}</div>
                  <div className="faq-a">{item.a}</div>
                </li>
              ))}
            </ul>
          </div></div>
        </section>

        {/* Kontakt */}
        <section
          className={`panel${activePanel === 'kontakt' ? ' open' : ''}`}
          id="kontakt"
          aria-hidden={activePanel !== 'kontakt'}
        >
          <div className="panel-inner"><div className="panel-content">
            <h2 className="panel-title">{t('kontakt.title')}</h2>
            <p className="panel-lead">{t('kontakt.lead')}</p>
            <ul className="contact-list">
              <li>
                <a className="contact-row" href="tel:+4367761638817">
                  <span className="contact-lbl">{t('kontakt.phone_label')}</span>
                  <span className="contact-val">{t('kontakt.phone_value')}</span>
                </a>
              </li>
              <li>
                <div className="contact-row contact-row-static">
                  <span className="contact-lbl">{t('kontakt.email_label')}</span>
                  <span className="contact-val">{t('kontakt.email_value')}</span>
                  <button
                    className="form-toggle-btn"
                    onClick={() => setShowForm(!showForm)}
                    aria-expanded={showForm}
                    type="button"
                  >
                    {t('kontakt.form_button')} →
                  </button>
                </div>
              </li>
            </ul>

            <div className={`contact-form-wrap${showForm ? ' open' : ''}`}>
              <form className="contact-form" onSubmit={handleFormSubmit} noValidate>
                {/* Honeypot — bots fill this, humans don't */}
                <div className="form-hp" aria-hidden="true">
                  <label htmlFor="contact-website">Website</label>
                  <input type="text" id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="contact-name">{t('kontakt.form_name')} *</label>
                  <input
                    className="form-input"
                    type="text"
                    id="contact-name"
                    name="name"
                    required
                    autoComplete="name"
                    value={formName}
                    onChange={(e) => { setFormName(e.target.value); setFormErrors(prev => ({ ...prev, name: '' })); }}
                  />
                  {formErrors.name && <div className="form-field-error">{formErrors.name}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="contact-email">{t('kontakt.form_email')} *</label>
                  <input
                    className="form-input"
                    type="email"
                    id="contact-email"
                    name="email"
                    required
                    autoComplete="email"
                    value={formEmail}
                    onChange={(e) => { setFormEmail(e.target.value); setFormErrors(prev => ({ ...prev, email: '' })); }}
                  />
                  {formErrors.email && <div className="form-field-error">{formErrors.email}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="contact-message">{t('kontakt.form_message')}</label>
                  <textarea
                    className="form-textarea"
                    id="contact-message"
                    name="message"
                    rows={3}
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                  />
                </div>

                <div className="form-checkbox-row">
                  <input
                    className="form-checkbox"
                    type="checkbox"
                    id="contact-consent"
                    name="consent"
                    required
                    checked={formConsent}
                    onChange={(e) => { setFormConsent(e.target.checked); setFormErrors(prev => ({ ...prev, consent: '' })); }}
                  />
                  <label className="form-checkbox-label" htmlFor="contact-consent">
                    {locale === 'de' ? (
                      <>Ich stimme der Verarbeitung meiner Daten gemäß{' '}
                        <button type="button" className="inline-link" onClick={() => openPanel('datenschutz')}>Datenschutzerklärung</button>{' '}
                        zu.</>
                    ) : (
                      <>I consent to the processing of my data in accordance with the{' '}
                        <button type="button" className="inline-link" onClick={() => openPanel('datenschutz')}>Privacy Policy</button>.</>
                    )}
                  </label>
                </div>
                {formErrors.consent && <div className="form-field-error">{formErrors.consent}</div>}

                <button className="form-submit" type="submit" disabled={formSending}>
                  {formSending ? t('kontakt.form_sending') : t('kontakt.form_submit')}
                </button>

                {formStatus && (
                  <div className={`form-status ${formStatus.type}`}>{formStatus.message}</div>
                )}
              </form>
            </div>
          </div></div>
        </section>

        {/* Impressum */}
        <section
          className={`panel${activePanel === 'impressum' ? ' open' : ''}`}
          id="impressum"
          aria-hidden={activePanel !== 'impressum'}
        >
          <div className="panel-inner"><div className="panel-content">
            <h2 className="panel-title">{t('impressum.title')}</h2>
            <div className="legal-body" dangerouslySetInnerHTML={{ __html: impressumHtml }} />
          </div></div>
        </section>

        {/* Datenschutzerklärung */}
        <section
          className={`panel${activePanel === 'datenschutz' ? ' open' : ''}`}
          id="datenschutz"
          aria-hidden={activePanel !== 'datenschutz'}
        >
          <div className="panel-inner"><div className="panel-content">
            <h2 className="panel-title" dangerouslySetInnerHTML={{ __html: datenschutzTitleShy }} />
            <div className="legal-body" dangerouslySetInnerHTML={{ __html: datenschutzHtml }} />
          </div></div>
        </section>

      </main>

      {/* ── FOOTER ────────────────────────────── */}
      <footer className="levcon-footer">
        <div className="footer-left">
          <div className="footer-legal">
            <button
              className={`footer-legal-btn${activePanel === 'impressum' ? ' active' : ''}`}
              onClick={() => openPanel('impressum')}
            >
              {t('footer.impressum')}
            </button>
            <span className="footer-legal-sep" aria-hidden="true">/</span>
            <button
              className={`footer-legal-btn${activePanel === 'datenschutz' ? ' active' : ''}`}
              onClick={() => openPanel('datenschutz')}
            >
              {t('footer.datenschutz')}
            </button>
          </div>
        </div>

        <div className="footer-center">
          <span className="footer-coords">48°14&apos;N · 16°30&apos;E</span>
          <div className="footer-dot" aria-hidden="true" />
          <div className="at-badge">
            <svg className="at-flag" width="24" height="16" viewBox="0 0 3 3"
                 xmlns="http://www.w3.org/2000/svg" aria-label={locale === 'de' ? 'Österreichische Flagge' : 'Austrian flag'}>
              <rect width="3" height="1" fill="#C8102E" />
              <rect y="1" width="3" height="1" fill="#FFFFFF" />
              <rect y="2" width="3" height="1" fill="#C8102E" />
            </svg>
            <span className="at-label">{t('footer.quality')}</span>
          </div>
          <div className="footer-dot" aria-hidden="true" />
          <span className="footer-copy">© {new Date().getFullYear()} Levcon.ai</span>
        </div>

        <div className="footer-right">
          <div className="lang-switch" role="group" aria-label={t('footer.lang_aria_label')}>
            <Link
              href={pathname || '/'}
              locale="de"
              className={`lang-btn${locale === 'de' ? ' active' : ''}`}
              aria-pressed={locale === 'de' ? 'true' : 'false'}
            >
              DE
            </Link>
            <div className="lang-divider" aria-hidden="true" />
            <Link
              href={pathname || '/'}
              locale="en"
              className={`lang-btn${locale === 'en' ? ' active' : ''}`}
              aria-pressed={locale === 'en' ? 'true' : 'false'}
            >
              EN
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

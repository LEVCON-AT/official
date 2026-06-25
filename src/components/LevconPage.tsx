'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations, useMessages } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

type PanelId = 'schulungen' | 'framework' | 'privacy' | 'faq' | 'kontakt' | 'impressum' | 'datenschutz';

const FADE_MS = 320;

export default function LevconPage({ locale }: { locale: string }) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [introHiding, setIntroHiding] = useState(false);
  const [introGone, setIntroGone] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      {/* Skip Navigation */}
      <a href="#main-content" className="skip-nav">
        {locale === 'de' ? 'Zum Inhalt springen' : 'Skip to content'}
      </a>

      {/* ── HEADER ────────────────────────────── */}
      <header className="levcon-header">
        <a className="logo-mark" href="/" onClick={handleLogoClick} aria-label={t('header.logo_aria_label')}>
          <div className="logo-placeholder" aria-hidden="true"><span>L</span></div>
          <span className="logo-wordmark">Levcon.ai</span>
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
                <a className="contact-row" href="mailto:hello@levcon.ai">
                  <span className="contact-lbl">{t('kontakt.email_label')}</span>
                  <span className="contact-val">{t('kontakt.email_value')}</span>
                </a>
              </li>
              <li>
                <a className="contact-row" href="https://levcon.at" target="_blank" rel="noopener">
                  <span className="contact-lbl">{t('kontakt.web_label')}</span>
                  <span className="contact-val">{t('kontakt.web_value')}</span>
                </a>
              </li>
              <li>
                <div className="contact-row" style={{ cursor: 'default', pointerEvents: 'none' }}>
                  <span className="contact-lbl">{t('kontakt.loc_label')}</span>
                  <span className="contact-val">{t('kontakt.loc_value')}</span>
                </div>
              </li>
            </ul>
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

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PanelId } from '@/components/panel-routing';

/**
 * MobileNav — Mobile Navigation mit Hamburger-Toggle
 *
 * Sticky Top-Bar mit Hamburger-Button + Logo.
 * Menu slidet von oben rein beim Öffnen (Sprint M3).
 *
 * Sichtbar nur bei ≤720px (via CSS).
 * Desktop-Navigation bleibt bei >720px unverändert.
 *
 * Sprint-Status:
 *  - M1: Grundgerüst mit Toggle-State
 *  - M2: Hamburger → X Animation
 *  - M3: Slide-Down Overlay + Backdrop + Stagger (dieser Sprint)
 *  - M4: Body-Scroll-Lock, ESC, Focus-Trap (folgt)
 *  - M5: Polish (folgt)
 *
 * Standards (per QUALITY-GUIDELINES.md):
 *  - Semantic HTML5 (button, nav, ul/li)
 *  - ARIA 1.2 (aria-expanded, aria-controls, aria-label, aria-modal)
 *  - WCAG 2.1 AA (Touch-Target ≥44×44px, Focus-Visible)
 *  - Keine Inline-Styles, keine Magic Numbers
 *  - Design-Tokens aus :root (var(--lc-*))
 */

type Props = {
  activePanel: PanelId | null;
  onNavClick: (target: string) => void;
  locale: string;
};

// Nav-Items in der Reihenfolge wie Desktop-Nav
const NAV_ITEMS: { target: string; key: string }[] = [
  { target: 'home',       key: 'header.nav_home' },
  { target: 'ainews',      key: 'header.nav_ainews' },
  { target: 'schulungen', key: 'header.nav_schulungen' },
  { target: 'framework',   key: 'header.nav_framework' },
  { target: 'privacy',     key: 'header.nav_privacy' },
  { target: 'faq',         key: 'header.nav_faq' },
  { target: 'kontakt',     key: 'header.nav_kontakt' },
];

export default function MobileNav({ activePanel, onNavClick, locale }: Props) {
  const t = useTranslations();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleItemClick = (target: string) => {
    onNavClick(target);
    // Auto-Close bei Item-Klick (grundlegend — Focus-Management kommt in Schritt 4)
    setIsMenuOpen(false);
  };

  // Dynamisches aria-label je nach State
  const toggleAriaLabel = isMenuOpen
    ? (locale === 'de' ? 'Menü schließen' : 'Close menu')
    : (locale === 'de' ? 'Menü öffnen' : 'Open menu');

  return (
    <>
      {/* ── STICKY TOP-BAR (Hamburger + Logo) ─────────────────── */}
      <div className="mobile-nav-bar" role="banner">
        <button
          type="button"
          className={`mobile-nav-toggle${isMenuOpen ? ' is-open' : ''}`}
          aria-label={toggleAriaLabel}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-nav-menu"
          onClick={toggleMenu}
        >
          <span className="mobile-nav-hamburger" aria-hidden="true">
            <span className="mobile-nav-hamburger-line mobile-nav-hamburger-line-top" />
            <span className="mobile-nav-hamburger-line mobile-nav-hamburger-line-middle" />
            <span className="mobile-nav-hamburger-line mobile-nav-hamburger-line-bottom" />
          </span>
        </button>

        <a
          className="mobile-nav-logo"
          href="/"
          aria-label={t('header.logo_aria_label')}
        >
          <span className="logo-wordmark">Levcon<span className="logo-ai">.AI</span></span>
        </a>
      </div>

      {/* ── MOBILE MENU (immer gerendert, Animation via CSS data-state) ── */}
      {/* Backdrop: halbtransparenter Hintergrund, schließt Menu bei Klick */}
      <div
        className={`mobile-nav-backdrop${isMenuOpen ? ' is-open' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      <nav
        id="mobile-nav-menu"
        className={`mobile-nav-menu${isMenuOpen ? ' is-open' : ''}`}
        aria-label={locale === 'de' ? 'Seitennavigation' : 'Page navigation'}
        data-state={isMenuOpen ? 'open' : 'closed'}
      >
        <ul className="mobile-nav-list" role="list">
          {NAV_ITEMS.map((item, index) => {
            const isActive =
              (item.target === 'home' && activePanel === null) ||
              (item.target !== 'home' && activePanel === item.target);

            return (
              <li
                key={item.target}
                className="mobile-nav-listitem"
                style={{ '--stagger-index': index } as React.CSSProperties}
              >
                <button
                  type="button"
                  className={`mobile-nav-item${isActive ? ' active' : ''}`}
                  onClick={() => handleItemClick(item.target)}
                  aria-current={isActive ? 'page' : undefined}
                  tabIndex={isMenuOpen ? 0 : -1}
                >
                  {t(item.key)}
                </button>
              </li>
            );
          })}
        </ul>

        {/* ── Sprachumschalter unten im Menu (Sprint M3) ── */}
        <div
          className="mobile-nav-lang-switch"
          role="group"
          aria-label={t('footer.lang_aria_label')}
        >
          <a
            href="/"
            className={`mobile-nav-lang-btn${locale === 'de' ? ' active' : ''}`}
            aria-current={locale === 'de' ? 'page' : undefined}
            tabIndex={isMenuOpen ? 0 : -1}
          >
            DE
          </a>
          <span className="mobile-nav-lang-divider" aria-hidden="true">/</span>
          <a
            href="/en"
            className={`mobile-nav-lang-btn${locale === 'en' ? ' active' : ''}`}
            aria-current={locale === 'en' ? 'page' : undefined}
            tabIndex={isMenuOpen ? 0 : -1}
          >
            EN
          </a>
        </div>
      </nav>
    </>
  );
}

import { db } from '@/lib/db';
import { getTranslations } from 'next-intl/server';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { routing } from '@/i18n/routing';
import type { Metadata } from 'next';

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'en' ? 'Confirm Subscription — Levcon.ai' : 'Abonnement bestätigen — Levcon.ai',
    robots: 'noindex, nofollow',
  };
}

export default async function ConfirmPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { token } = await searchParams;

  // Validate token format
  if (!token || typeof token !== 'string' || token.length < 32) {
    return <ConfirmResult status="invalid" locale={locale} />;
  }

  try {
    const subscriber = await db.newsletterSubscriber.findUnique({
      where: { confirmToken: token },
    });

    if (!subscriber) {
      return <ConfirmResult status="invalid" locale={locale} />;
    }

    // Already confirmed
    if (subscriber.confirmedAt && !subscriber.unsubscribedAt) {
      return <ConfirmResult status="already" locale={locale} />;
    }

    // Token expired (createdAt + 7 days < now)
    if (Date.now() - subscriber.createdAt.getTime() > TOKEN_EXPIRY_MS) {
      // Delete expired unconfirmed record
      await db.newsletterSubscriber.delete({ where: { id: subscriber.id } });
      return <ConfirmResult status="invalid" locale={locale} />;
    }

    // Confirm subscription
    await db.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        confirmedAt: new Date(),
        unsubscribedAt: null,
      },
    });

    return <ConfirmResult status="confirmed" locale={locale} />;
  } catch (error) {
    console.error('Newsletter confirm page error:', error);
    return <ConfirmResult status="invalid" locale={locale} />;
  }
}

// ─── Result Component ───────────────────────────────────────────

function ConfirmResult({ status, locale }: { status: 'confirmed' | 'already' | 'invalid'; locale: string }) {
  const isEn = locale === 'en';

  const content = {
    confirmed: {
      title: isEn ? 'Subscription confirmed' : 'Anmeldung bestätigt',
      message: isEn
        ? 'Welcome to Levcon AI News. You will receive your first newsletter with the next daily edition.'
        : 'Willkommen bei Levcon AI News. Sie erhalten Ihren ersten Newsletter mit der nächsten täglichen Ausgabe.',
    },
    already: {
      title: isEn ? 'Already subscribed' : 'Bereits abonniert',
      message: isEn
        ? 'Your subscription is already active. No action needed.'
        : 'Ihr Abonnement ist bereits aktiv. Keine Aktion erforderlich.',
    },
    invalid: {
      title: isEn ? 'Invalid or expired link' : 'Ungültiger oder abgelaufener Link',
      message: isEn
        ? 'This confirmation link is invalid or has expired. Please sign up again to receive a new link.'
        : 'Dieser Bestätigungslink ist ungültig oder abgelaufen. Bitte melden Sie sich erneut an, um einen neuen Link zu erhalten.',
    },
  };

  const { title, message } = content[status];
  const newsLink = isEn ? '/en/ai-news' : '/ai-news';
  const newsLabel = isEn ? 'Go to AI News' : 'Zu den AI News';
  const homeLabel = isEn ? 'Back to home' : 'Zurück zur Startseite';

  return (
    <main className="confirm-page">
      <div className="confirm-card">
        <div className="confirm-logo">
          <span className="confirm-wordmark">LEVCON<span className="confirm-ai">.AI</span></span>
        </div>

        <div className="confirm-label">
          {isEn ? 'AI News' : 'AI News'}
        </div>

        <h1 className="confirm-title">{title}</h1>

        <p className="confirm-message">{message}</p>

        <div className="confirm-actions">
          <Link href={newsLink} className="confirm-btn">
            {newsLabel} →
          </Link>
          <Link href={isEn ? '/en' : '/'} className="confirm-link">
            {homeLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}

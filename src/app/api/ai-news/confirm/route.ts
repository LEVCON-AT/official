import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://levcon.ai';
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * GET /api/ai-news/confirm?token=...
 *
 * Confirms a newsletter subscription by validating the token,
 * setting confirmedAt, and redirecting to the homepage with a status flag.
 *
 * DSGVO: Double-Opt-In completion. Token must be valid and not expired.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token || typeof token !== 'string' || token.length < 32) {
      return redirectToHome('error', 'invalid');
    }

    const subscriber = await db.newsletterSubscriber.findUnique({
      where: { confirmToken: token },
    });

    if (!subscriber) {
      return redirectToHome('error', 'invalid');
    }

    // Already confirmed
    if (subscriber.confirmedAt && !subscriber.unsubscribedAt) {
      return redirectToHome(subscriber.language, 'already');
    }

    // Token expired (createdAt + 7 days < now)
    if (Date.now() - subscriber.createdAt.getTime() > TOKEN_EXPIRY_MS) {
      // Delete expired unconfirmed record
      await db.newsletterSubscriber.delete({ where: { id: subscriber.id } });
      return redirectToHome('error', 'invalid');
    }

    // Confirm subscription
    await db.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        confirmedAt: new Date(),
        unsubscribedAt: null,
      },
    });

    return redirectToHome(subscriber.language, 'confirmed');
  } catch (error) {
    console.error('Newsletter confirm error:', error);
    return redirectToHome('error', 'invalid');
  }
}

/**
 * Redirects to the homepage with a status query param.
 * The frontend can read this param to show a success/error message.
 */
function redirectToHome(language: string, status: string): NextResponse {
  const localePath = language === 'en' ? '/en' : '';
  const newsSlug = language === 'en' ? 'ai-news' : 'ai-news';
  const url = `${SITE_URL}${localePath}/${newsSlug}?news=${status}`;
  return NextResponse.redirect(url, { status: 303 });
}

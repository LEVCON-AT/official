import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://levcon.ai';

/**
 * GET /api/ai-news/unsubscribe?token=...
 *
 * Unsubscribes a newsletter subscriber by validating their token
 * and setting unsubscribedAt. Soft-delete (30 days retention per DSGVO policy).
 *
 * RFC 8058 One-Click-Unsubscribe: This endpoint supports both
 * GET (manual click) and POST (List-Unsubscribe-Post header).
 */
export async function GET(request: NextRequest) {
  return handleUnsubscribe(request);
}

export async function POST(request: NextRequest) {
  return handleUnsubscribe(request);
}

async function handleUnsubscribe(request: NextRequest): Promise<NextResponse> {
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

    // Already unsubscribed
    if (subscriber.unsubscribedAt) {
      return redirectToHome(subscriber.language, 'unsubscribed');
    }

    // Mark as unsubscribed (soft delete)
    await db.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        unsubscribedAt: new Date(),
      },
    });

    return redirectToHome(subscriber.language, 'unsubscribed');
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    return redirectToHome('error', 'invalid');
  }
}

function redirectToHome(language: string, status: string): NextResponse {
  const localePath = language === 'en' ? '/en' : '';
  const url = `${SITE_URL}${localePath}/ai-news?news=${status}`;
  return NextResponse.redirect(url, { status: 303 });
}

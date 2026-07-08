import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID_LANG_CODES = ['de', 'en', 'zh', 'ja', 'fr', 'es', 'it', 'pt', 'ru', 'ar', 'tr', 'nl', 'pl', 'ko', 'hi'];
const VALID_FREQUENCIES = ['daily', 'weekly', 'digest'];
const VALID_NEWSLETTER_LANGS = ['de', 'en'];

/**
 * GET /api/ai-news/subscriber?token=...
 *
 * Returns subscriber data by confirm token.
 * Used by the settings page to pre-fill the form.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token || token.length < 32) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const subscriber = await db.newsletterSubscriber.findUnique({
      where: { confirmToken: token },
      select: {
        id: true,
        email: true,
        language: true,
        newsLanguages: true,
        frequency: true,
        confirmedAt: true,
        unsubscribedAt: true,
      },
    });

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    if (subscriber.unsubscribedAt) {
      return NextResponse.json({ error: 'Subscriber unsubscribed' }, { status: 410 });
    }

    return NextResponse.json({ subscriber });
  } catch (error) {
    console.error('Subscriber GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/ai-news/subscriber?token=...
 *
 * Updates subscriber preferences (language, newsLanguages, frequency).
 * Body: { language?, newsLanguages?, frequency? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token || token.length < 32) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const subscriber = await db.newsletterSubscriber.findUnique({
      where: { confirmToken: token },
    });

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    if (subscriber.unsubscribedAt) {
      return NextResponse.json({ error: 'Subscriber unsubscribed' }, { status: 410 });
    }

    const body = await request.json();
    const updates: {
      language?: string;
      newsLanguages?: string;
      frequency?: string;
    } = {};

    // Validate and set language (newsletter language)
    if (typeof body.language === 'string' && VALID_NEWSLETTER_LANGS.includes(body.language)) {
      updates.language = body.language;
    }

    // Validate and set newsLanguages
    if (typeof body.newsLanguages === 'string') {
      const requested = body.newsLanguages.split(',').map((l: string) => l.trim()).filter((l: string) => VALID_LANG_CODES.includes(l));
      if (requested.length > 0) {
        updates.newsLanguages = requested.join(',');
      }
    }

    // Validate and set frequency
    if (typeof body.frequency === 'string' && VALID_FREQUENCIES.includes(body.frequency)) {
      updates.frequency = body.frequency;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await db.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: updates,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscriber PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

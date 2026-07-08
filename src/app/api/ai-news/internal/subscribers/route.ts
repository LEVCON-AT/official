import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/ai-news/internal/subscribers?frequency=daily&language=de
 *
 * Internal endpoint — called by n8n to fetch subscribers for newsletter send.
 * Protected by LEVCON_INTERNAL_API_KEY header.
 *
 * Returns confirmed, active subscribers (not unsubscribed) matching the filter.
 * lastSentDate is updated by n8n via PATCH after successful send.
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('x-levcon-api-key');
    const expectedKey = process.env.LEVCON_INTERNAL_API_KEY;

    if (!expectedKey || authHeader !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const frequency = searchParams.get('frequency'); // daily | weekly | digest
    const language = searchParams.get('language');   // de | en

    // Validate frequency
    if (frequency && !['daily', 'weekly', 'digest'].includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
    }

    // Validate language
    if (language && !['de', 'en'].includes(language)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
    }

    // Build where clause
    const where: {
      confirmedAt: { not: null };
      unsubscribedAt: null;
      frequency?: string;
      language?: string;
    } = {
      confirmedAt: { not: null },
      unsubscribedAt: null,
    };

    if (frequency) where.frequency = frequency;
    if (language) where.language = language;

    const subscribers = await db.newsletterSubscriber.findMany({
      where,
      select: {
        id: true,
        email: true,
        language: true,
        newsLanguages: true,
        frequency: true,
        confirmToken: true,
        lastSentDate: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      count: subscribers.length,
      subscribers,
    });
  } catch (error) {
    console.error('Subscribers fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ai-news/internal/subscribers/[id]/last-sent
 *
 * Updates lastSentDate after successful newsletter send.
 * Body: { "lastSentDate": "2025-07-01T06:00:00.000Z" }
 */
export async function PATCH(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('x-levcon-api-key');
    const expectedKey = process.env.LEVCON_INTERNAL_API_KEY;

    if (!expectedKey || authHeader !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subscriberId = searchParams.get('id');

    if (!subscriberId) {
      return NextResponse.json({ error: 'Missing subscriber id' }, { status: 400 });
    }

    const body = await request.json();
    const { lastSentDate } = body;

    if (!lastSentDate || isNaN(new Date(lastSentDate).getTime())) {
      return NextResponse.json({ error: 'Invalid lastSentDate' }, { status: 400 });
    }

    await db.newsletterSubscriber.update({
      where: { id: parseInt(subscriberId, 10) },
      data: { lastSentDate: new Date(lastSentDate) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscriber update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

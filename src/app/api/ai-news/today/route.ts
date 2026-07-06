import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/ai-news/today
 *
 * Public endpoint — returns today's AI news (summary + items).
 * Used by n8n newsletter workflow to fetch news for email rendering.
 *
 * Returns null if no news published yet today.
 */
export async function GET() {
  try {
    // Use Vienna timezone (same as getTodaysNews in data.ts)
    const now = new Date();
    const viennaDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Vienna',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const startOfDay = new Date(viennaDateStr + 'T00:00:00.000Z');
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const summary = await db.aiNewsSummary.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!summary) {
      return NextResponse.json({ news: null });
    }

    return NextResponse.json({
      news: {
        date: summary.date,
        summaryDe: summary.summaryDe,
        summaryEn: summary.summaryEn,
        items: summary.items.map((item) => ({
          id: item.id,
          position: item.position,
          headline: item.headline,
          descriptionDe: item.descriptionDe,
          descriptionEn: item.descriptionEn,
          source: item.source,
          sourceUrl: item.sourceUrl,
          thumbnailUrl: item.thumbnailUrl,
          languageOrig: item.languageOrig,
        })),
      },
    });
  } catch (error) {
    console.error('Today news API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/ai-news/internal/ingest
 *
 * Internal endpoint — called by n8n workflow to ingest curated AI news.
 * Protected by LEVCON_INTERNAL_API_KEY header.
 *
 * Body shape:
 * {
 *   "date": "2025-07-01",          // ISO date (UTC midnight)
 *   "summaryDe": "...",
 *   "summaryEn": "...",
 *   "items": [
 *     {
 *       "position": 1,
 *       "headline": "...",
 *       "descriptionDe": "...",
 *       "descriptionEn": "...",
 *       "source": "MIT Tech Review",
 *       "sourceUrl": "https://...",
 *       "thumbnailUrl": "https://..." | null,
 *       "languageOrig": "en"
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('x-levcon-api-key');
    const expectedKey = process.env.LEVCON_INTERNAL_API_KEY;

    if (!expectedKey || authHeader !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, summaryDe, summaryEn, items } = body;

    // Validation
    if (!date || typeof date !== 'string') {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    if (!summaryDe || typeof summaryDe !== 'string') {
      return NextResponse.json({ error: 'Invalid summaryDe' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items must be non-empty array' }, { status: 400 });
    }

    // Parse date (expect YYYY-MM-DD, store as UTC midnight)
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }
    const utcMidnight = new Date(Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
      parsedDate.getUTCDate()
    ));

    // Upsert summary (delete existing for this date first)
    await db.aiNewsItem.deleteMany({
      where: { summary: { date: utcMidnight } },
    });
    await db.aiNewsSummary.deleteMany({
      where: { date: utcMidnight },
    });

    // Create new summary with items
    const summary = await db.aiNewsSummary.create({
      data: {
        date: utcMidnight,
        summaryDe,
        summaryEn: summaryEn || null,
        items: {
          create: items.map((item: {
            position: number;
            headline: string;
            descriptionDe: string;
            descriptionEn?: string | null;
            source: string;
            sourceUrl: string;
            thumbnailUrl?: string | null;
            languageOrig?: string;
          }, idx: number) => ({
            position: item.position || idx + 1,
            headline: item.headline,
            descriptionDe: item.descriptionDe,
            descriptionEn: item.descriptionEn || null,
            source: item.source,
            sourceUrl: item.sourceUrl,
            thumbnailUrl: item.thumbnailUrl || null,
            languageOrig: item.languageOrig || 'en',
          })),
        },
      },
      include: { items: true },
    });

    // Log to WorkflowRun for monitoring
    await db.workflowRun.create({
      data: {
        workflowId: 'ingest',
        runAt: new Date(),
        status: 'success',
        itemCount: items.length,
      },
    });

    return NextResponse.json({
      success: true,
      summaryId: summary.id,
      itemCount: summary.items.length,
    });
  } catch (error) {
    console.error('Ingest error:', error);

    // Log error
    try {
      await db.workflowRun.create({
        data: {
          workflowId: 'ingest',
          runAt: new Date(),
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    } catch {}

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

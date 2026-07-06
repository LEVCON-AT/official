import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/ai-news/internal/cleanup
 *
 * Internal endpoint — called daily by n8n cleanup workflow.
 * Protected by LEVCON_INTERNAL_API_KEY header.
 *
 * Deletes:
 * - Unconfirmed subscribers older than 7 days
 * - Unsubscribed subscribers older than 30 days
 * - Workflow runs older than 90 days
 *
 * Body (optional):
 * {
 *   "olderThanDays": {
 *     "unconfirmed": 7,
 *     "unsubscribed": 30,
 *     "workflowRuns": 90
 *   }
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

    // Default retention values
    let unconfirmedDays = 7;
    let unsubscribedDays = 30;
    let workflowRunsDays = 90;

    // Parse body (optional overrides)
    try {
      const body = await request.json();
      if (body?.olderThanDays?.unconfirmed) unconfirmedDays = body.olderThanDays.unconfirmed;
      if (body?.olderThanDays?.unsubscribed) unsubscribedDays = body.olderThanDays.unsubscribed;
      if (body?.olderThanDays?.workflowRuns) workflowRunsDays = body.olderThanDays.workflowRuns;
    } catch {
      // Body is optional, OK to fail
    }

    const now = new Date();

    // 1. Delete unconfirmed subscribers older than X days
    const unconfirmedCutoff = new Date(now.getTime() - unconfirmedDays * 24 * 60 * 60 * 1000);
    const unconfirmedDeleted = await db.newsletterSubscriber.deleteMany({
      where: {
        confirmedAt: null,
        createdAt: { lt: unconfirmedCutoff },
      },
    });

    // 2. Delete unsubscribed subscribers older than X days
    const unsubscribedCutoff = new Date(now.getTime() - unsubscribedDays * 24 * 60 * 60 * 1000);
    const unsubscribedDeleted = await db.newsletterSubscriber.deleteMany({
      where: {
        unsubscribedAt: { lt: unsubscribedCutoff },
      },
    });

    // 3. Delete workflow runs older than X days
    const workflowRunsCutoff = new Date(now.getTime() - workflowRunsDays * 24 * 60 * 60 * 1000);
    const workflowRunsDeleted = await db.workflowRun.deleteMany({
      where: {
        createdAt: { lt: workflowRunsCutoff },
      },
    });

    // Log this cleanup run
    await db.workflowRun.create({
      data: {
        workflowId: 'cleanup',
        runAt: now,
        status: 'success',
        itemCount: unconfirmedDeleted.count + unsubscribedDeleted.count + workflowRunsDeleted.count,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        unconfirmed: unconfirmedDeleted.count,
        unsubscribed: unsubscribedDeleted.count,
        workflowRuns: workflowRunsDeleted.count,
      },
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

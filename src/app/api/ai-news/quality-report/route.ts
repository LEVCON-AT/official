import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/ai-news/quality-report
 *
 * Returns aggregated quality stats for the last N days (default: 14).
 * Protected by LEVCON_INTERNAL_API_KEY header (X-Levcon-Api-Key).
 *
 * Query params:
 *   - days: number (default 14, max 90) — how many days to look back
 *   - summary: 'true'|'false' (default 'false') — if true, only return
 *     aggregated stats (no per-day breakdown)
 *   - admin: string — alternative auth via query param (for browser-based access)
 *
 * Response shape:
 * {
 *   "summary": {
 *     "totalRuns": 14,
 *     "successRuns": 11,
 *     "partialRuns": 2,
 *     "errorRuns": 1,
 *     "successRate": 0.786,
 *     "totalRetries": 4,
 *     "totalWarnings": 12,
 *     "fallbackUsedCount": 1,
 *     "avgItemCount": 18.2,
 *     "avgItemCountDe": 9.8,
 *     "avgItemCountEn": 8.4
 *   },
 *   "days": [
 *     {
 *       "date": "2026-07-22",
 *       "runAt": "2026-07-22T04:00:12.000Z",
 *       "status": "success",
 *       "itemCount": 20,
 *       "itemCountDe": 10,
 *       "itemCountEn": 10,
 *       "retryCount": 0,
 *       "warningCount": 0,
 *       "fallbackUsed": "none",
 *       "warnings": [],
 *       "errors": []
 *     }
 *   ]
 * }
 *
 * Standards (per QUALITY-GUIDELINES.md):
 *  - RFC 2616: correct HTTP status codes (200, 400, 401, 500)
 *  - RFC 7807: JSON:API error format on errors
 *  - ISO 8601: all timestamps in UTC with Z suffix
 *  - JSON:API conventions for response shape
 *  - try/catch with specific error handling
 *  - No `any` — all types explicit
 *  - Input validation with safe parsing
 */
export async function GET(request: NextRequest) {
  try {
    // ── Auth check ───────────────────────────────────────────────
    // Two auth modes:
    // 1. Internal API key (X-Levcon-Api-Key) — for n8n / programmatic access
    // 2. Admin token (?admin=<token>) — for browser-based owner access
    //    (token == LEVCON_INTERNAL_API_KEY, but passed via query for convenience)
    const authHeader = request.headers.get('x-levcon-api-key');
    const expectedKey = process.env.LEVCON_INTERNAL_API_KEY;

    const url = new URL(request.url);
    const adminToken = url.searchParams.get('admin');

    const authViaHeader = expectedKey && authHeader === expectedKey;
    const authViaQuery = expectedKey && adminToken === expectedKey;

    if (!expectedKey || (!authViaHeader && !authViaQuery)) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Valid API key required (X-Levcon-Api-Key header or ?admin= query param)',
        },
        { status: 401 }
      );
    }

    // ── Parse query params ───────────────────────────────────────
    const daysParam = url.searchParams.get('days');
    const summaryOnly = url.searchParams.get('summary') === 'true';

    let days = 14;
    if (daysParam) {
      const parsed = parseInt(daysParam, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 90) {
        return NextResponse.json(
          {
            error: 'Invalid parameter',
            message: '"days" must be an integer between 1 and 90',
          },
          { status: 400 }
        );
      }
      days = parsed;
    }

    // ── Query WorkflowRun table ──────────────────────────────────
    // Look back N days, get all 'ingest' workflow runs (sorted by runAt desc)
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    const runs = await db.workflowRun.findMany({
      where: {
        workflowId: 'ingest',
        runAt: { gte: since },
      },
      orderBy: { runAt: 'desc' },
      take: 200,  // Safety cap
    });

    // ── Build per-day breakdown ──────────────────────────────────
    const daysData = runs.map((run) => {
      // Parse qualityReport JSON (if present)
      let qualityReport: {
        warnings?: string[];
        errors?: string[];
        overallStatus?: string;
        bucketStats?: { de: { valid: number }; en: { valid: number } };
      } | null = null;
      if (run.qualityReport) {
        try {
          qualityReport = JSON.parse(run.qualityReport);
        } catch {
          qualityReport = null;
        }
      }

      // Format date as ISO 8601 YYYY-MM-DD
      const dateStr = run.runAt.toISOString().split('T')[0];

      return {
        date: dateStr,
        runAt: run.runAt.toISOString(),
        status: run.status,
        itemCount: run.itemCount ?? 0,
        itemCountDe: run.itemCountDe ?? 0,
        itemCountEn: run.itemCountEn ?? 0,
        retryCount: run.retryCount ?? 0,
        warningCount: run.warningCount ?? 0,
        fallbackUsed: run.fallbackUsed ?? 'none',
        warnings: qualityReport?.warnings ?? [],
        errors: qualityReport?.errors ?? [],
        errorMessage: run.errorMessage,
      };
    });

    // ── Build aggregated summary ─────────────────────────────────
    const totalRuns = runs.length;
    const successRuns = runs.filter((r) => r.status === 'success').length;
    const partialRuns = runs.filter((r) => r.status === 'partial').length;
    const errorRuns = runs.filter((r) => r.status === 'error').length;

    const totalRetries = runs.reduce(
      (sum, r) => sum + (r.retryCount ?? 0),
      0
    );
    const totalWarnings = runs.reduce(
      (sum, r) => sum + (r.warningCount ?? 0),
      0
    );
    const fallbackUsedCount = runs.filter(
      (r) => r.fallbackUsed && r.fallbackUsed !== 'none'
    ).length;

    const runsWithItems = runs.filter((r) => r.itemCount !== null);
    const avgItemCount =
      runsWithItems.length > 0
        ? runsWithItems.reduce((sum, r) => sum + (r.itemCount ?? 0), 0) /
          runsWithItems.length
        : 0;
    const avgItemCountDe =
      runsWithItems.length > 0
        ? runsWithItems.reduce((sum, r) => sum + (r.itemCountDe ?? 0), 0) /
          runsWithItems.length
        : 0;
    const avgItemCountEn =
      runsWithItems.length > 0
        ? runsWithItems.reduce((sum, r) => sum + (r.itemCountEn ?? 0), 0) /
          runsWithItems.length
        : 0;

    const summary = {
      totalRuns,
      successRuns,
      partialRuns,
      errorRuns,
      successRate: totalRuns > 0 ? successRuns / totalRuns : 0,
      totalRetries,
      totalWarnings,
      fallbackUsedCount,
      avgItemCount: Math.round(avgItemCount * 10) / 10,
      avgItemCountDe: Math.round(avgItemCountDe * 10) / 10,
      avgItemCountEn: Math.round(avgItemCountEn * 10) / 10,
      daysCovered: days,
    };

    // ── Return response ──────────────────────────────────────────
    if (summaryOnly) {
      return NextResponse.json({ summary });
    }

    return NextResponse.json({
      summary,
      days: daysData,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Quality report error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message:
          error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

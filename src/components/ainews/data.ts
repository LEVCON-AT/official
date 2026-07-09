import { db } from '@/lib/db';
import type { AiNewsItemType } from '@/components/ainews/AiNewsItem';

export const revalidate = 3600; // 1 hour cache

export type AiNewsData = {
  date: Date;
  summaryDe: string;
  summaryEn: string | null;
  items: AiNewsItemType[];
};

// Type for a single news item — includes translated headlines
// headlineDe/headlineEn are optional (null for legacy items before v3)

/**
 * Loads today's AI news from DB.
 * Returns null if no news published yet today.
 * Server-only — do not import in client components.
 */
/**
 * Helper: Get start of "today" in Europe/Vienna timezone as UTC Date.
 * n8n runs in Europe/Vienna, so news are stored with Vienna dates.
 * Next.js runs in UTC, so we need to convert.
 */
function getViennaTodayRange(): { startOfDay: Date; endOfDay: Date } {
  const now = new Date();
  // Format current date in Vienna timezone (YYYY-MM-DD)
  const viennaDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  // Create UTC midnight for that Vienna date
  const startOfDay = new Date(viennaDateStr + 'T00:00:00.000Z');
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  return { startOfDay, endOfDay };
}

export async function getTodaysNews(): Promise<AiNewsData | null> {
  const { startOfDay, endOfDay } = getViennaTodayRange();

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

  if (!summary) return null;

  return mapSummary(summary);
}

/**
 * Loads archived AI news (excludes today).
 * Returns past editions sorted by date descending.
 *
 * @param limit Maximum number of archived editions (default 30)
 * @param locale Used to determine "today" cutoff
 * Server-only.
 */
export async function getArchivedNews(limit: number = 30): Promise<AiNewsData[]> {
  const { startOfDay } = getViennaTodayRange();

  const summaries = await db.aiNewsSummary.findMany({
    where: {
      date: {
        lt: startOfDay,
      },
    },
    include: {
      items: {
        orderBy: { position: 'asc' },
      },
    },
    orderBy: {
      date: 'desc',
    },
    take: Math.min(limit, 90), // Cap at 90 to avoid heavy queries
  });

  return summaries.map(mapSummary);
}

function mapSummary(summary: {
  date: Date;
  summaryDe: string;
  summaryEn: string | null;
  items: Array<{
    id: number;
    position: number;
    headline: string;
    headlineDe: string | null;
    headlineEn: string | null;
    descriptionDe: string;
    descriptionEn: string | null;
    source: string;
    sourceUrl: string;
    thumbnailUrl: string | null;
    languageOrig: string;
    category: string | null;
  }>;
}): AiNewsData {
  return {
    date: summary.date,
    summaryDe: summary.summaryDe,
    summaryEn: summary.summaryEn,
    items: summary.items.map((item) => ({
      id: item.id,
      position: item.position,
      headline: item.headline,
      headlineDe: item.headlineDe,
      headlineEn: item.headlineEn,
      descriptionDe: item.descriptionDe,
      descriptionEn: item.descriptionEn,
      source: item.source,
      sourceUrl: item.sourceUrl,
      thumbnailUrl: item.thumbnailUrl,
      languageOrig: item.languageOrig,
      category: item.category,
    })),
  };
}

import { db } from '@/lib/db';
import type { AiNewsItemType } from '@/components/ainews/AiNewsItem';

export const revalidate = 3600; // 1 hour cache

export type AiNewsData = {
  date: Date;
  summaryDe: string;
  summaryEn: string | null;
  items: AiNewsItemType[];
};

/**
 * Loads today's AI news from DB.
 * Returns null if no news published yet today.
 * Server-only — do not import in client components.
 */
export async function getTodaysNews(): Promise<AiNewsData | null> {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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

  if (!summary) return null;

  return {
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
  };
}

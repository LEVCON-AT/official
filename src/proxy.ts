import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  // WICHTIG: NEXT_LOCALE Cookie immer löschen, damit User nicht in
  // einer Locale "gefangen" bleiben. Die Locale wird ausschließlich
  // anhand der URL bestimmt (localeDetection: false in routing.ts).
  // Dies fixt den Bug wo der DE-Sprachbutton auf levcon.ai nicht
  // "active" war (Cookie=en hat DE-Link auf /en weitergeleitet).
  response.cookies.delete('NEXT_LOCALE');

  return response;
}

// Standard next-intl Matcher: fängt ALLE Seitenrouten ab,
// außer api, _next, _vercel und statischen Dateien (mit Punkt).
//
// WICHTIG: Der vorherige Matcher ['/', '/(de|en)/:path*'] war zu
// restriktiv — er hat DE-Routen OHNE Prefix (wie /ai-news, /kontakt)
// nicht abgefangen. Mit localePrefix:'as-needed' haben DE-URLs keinen
// /de/ Prefix, also lief die Middleware nie für DE-Panel-Routen.
// Dadurch konnte next-intl die Locale nicht erkennen und Next.js
// konnte die Route [locale]/[panel] nicht matchen → nur die URL
// änderte sich, aber der Panel-Inhalt wechselte nicht.
export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};

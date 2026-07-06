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
  if (response.cookies.has('NEXT_LOCALE')) {
    response.cookies.delete('NEXT_LOCALE');
  }

  return response;
}

export const config = {
  matcher: ['/', '/(de|en)/:path*'],
};

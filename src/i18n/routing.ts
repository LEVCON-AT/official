import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
  localePrefix: 'as-needed',
  // WICHTIG: localeDetection deaktivieren — sonst setzt next-intl ein
  // NEXT_LOCALE Cookie, das den User in einer Locale "gefangen hält".
  // Beispiel: User auf /en klickt DE-Link (href="/") → middleware sieht
  // Cookie=en und leitet wieder nach /en weiter. Mit localeDetection:false
  // wird die Locale nur anhand der URL bestimmt (nicht Cookie/Accept-Language).
  localeDetection: false,
});

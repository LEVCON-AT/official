import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import LevconPage from '@/components/LevconPage';
import { getTodaysNews, getArchivedNews } from '@/components/ainews/data';
import { getPanelFromSlug, getPanelSlug, getAllSlugs, PANEL_META, DE_SLUGS, EN_SLUGS, type PanelId } from '@/components/panel-routing';
import type { Metadata, Viewport } from 'next';

type Props = {
  params: Promise<{ locale: string; panel: string }>;
};

export const dynamicParams = false;

// Generate all valid locale + panel combinations
export function generateStaticParams() {
  const params: { locale: string; panel: string }[] = [];
  for (const locale of routing.locales) {
    for (const slug of getAllSlugs(locale)) {
      params.push({ locale, panel: slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, panel: slug } = await params;
  const panelId = getPanelFromSlug(slug, locale);

  if (!panelId) {
    return { title: 'Not Found — Levcon.ai' };
  }

  const meta = PANEL_META[panelId];
  const baseUrl = 'https://levcon.ai';
  const currentSlug = getPanelSlug(panelId, locale);
  const localeUrl = locale === 'de' ? `${baseUrl}/${currentSlug}` : `${baseUrl}/en/${currentSlug}`;
  const alternateLocale = locale === 'de' ? 'en' : 'de';
  const altSlug = getPanelSlug(panelId, alternateLocale);
  const alternateUrl = alternateLocale === 'de' ? `${baseUrl}/${altSlug}` : `${baseUrl}/en/${altSlug}`;

  return {
    title: locale === 'de' ? meta.titleDe : meta.titleEn,
    description: locale === 'de' ? meta.descDe : meta.descEn,
    authors: [{ name: 'Mst. Enric-Bernard Sep-Albi, BA, MBA' }],
    robots: 'index, follow',
    alternates: {
      canonical: localeUrl,
      languages: {
        de: `${baseUrl}/${DE_SLUGS[panelId]}`,
        en: `${baseUrl}/en/${EN_SLUGS[panelId]}`,
        'x-default': `${baseUrl}/${DE_SLUGS[panelId]}`,
      },
    },
    openGraph: {
      type: 'website',
      url: localeUrl,
      title: locale === 'de' ? meta.titleDe : meta.titleEn,
      description: locale === 'de' ? meta.descDe : meta.descEn,
      locale: locale === 'de' ? 'de_AT' : 'en_GB',
      siteName: 'Levcon.ai',
      images: [{ url: `${baseUrl}/og-image.png`, width: 1344, height: 768, alt: 'Levcon.ai' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: locale === 'de' ? meta.titleDe : meta.titleEn,
      description: locale === 'de' ? meta.descDe : meta.descEn,
      images: [`${baseUrl}/og-image.png`],
    },
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon-512.png', type: 'image/png', sizes: '512x512' },
      ],
      apple: '/favicon-512.png',
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#F0EFEC',
  colorScheme: 'light',
};

export default async function PanelPage({ params }: Props) {
  const { locale, panel: slug } = await params;
  setRequestLocale(locale);

  const panelId = getPanelFromSlug(slug, locale);
  if (!panelId) {
    // This shouldn't happen due to dynamicParams = false
    return null;
  }

  // Load AI news (only needed for ainews panel, but loaded for all since shared layout)
  const [todaysNews, archivedNews] = await Promise.all([
    getTodaysNews(),
    getArchivedNews(30),
  ]);

  const baseUrl = 'https://levcon.ai';

  // Schema.org for panel pages
  const schemaOrg = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfessionalService',
        name: 'Levcon.ai',
        url: baseUrl,
        founder: {
          '@type': 'Person',
          name: 'Mst. Enric-Bernard Sep-Albi, BA, MBA',
        },
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Pfalzgasse 37/2/4',
          addressLocality: 'Wien',
          postalCode: '1220',
          addressCountry: 'AT',
        },
        email: 'hello@levcon.ai',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
      />
      <LevconPage
        key={locale + '-' + panelId}
        locale={locale}
        todaysNews={todaysNews}
        archivedNews={archivedNews}
        initialPanel={panelId}
      />
    </>
  );
}

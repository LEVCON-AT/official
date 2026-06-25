import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import LevconPage from '@/components/LevconPage';
import type { Metadata, Viewport } from 'next';

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const baseUrl = 'https://levcon.ai';
  const localeUrl = locale === 'de' ? baseUrl : `${baseUrl}/en`;
  const alternateLocale = locale === 'de' ? 'en' : 'de';
  const alternateUrl = alternateLocale === 'de' ? baseUrl : `${baseUrl}/en`;

  return {
    title: t('title'),
    description: t('description'),
    authors: [{ name: 'Mst. Enric-Bernard Sep-Albi, BA, MBA' }],
    robots: 'index, follow',
    alternates: {
      canonical: localeUrl,
      languages: {
        de: baseUrl,
        en: `${baseUrl}/en`,
        'x-default': baseUrl,
      },
    },
    openGraph: {
      type: 'website',
      url: localeUrl,
      title: t('og_title'),
      description: t('og_description'),
      locale: locale === 'de' ? 'de_AT' : 'en_GB',
      alternateLocale: locale === 'de' ? 'en_GB' : 'de_AT',
      siteName: 'Levcon.ai',
      images: [
        {
          url: `${baseUrl}/og-image.png`,
          width: 1344,
          height: 768,
          alt: locale === 'de' ? 'Levcon.ai — KI-Beratung & Schulungen aus Wien' : 'Levcon.ai — AI Consulting & Training from Vienna',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('og_title'),
      description: t('og_description'),
      images: [`${baseUrl}/og-image.png`],
    },
    icons: {
      icon: '/favicon-512.png',
      apple: '/favicon-512.png',
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#F0EFEC',
  colorScheme: 'light',
};

export default async function LocalePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LevconPage locale={locale} />;
}

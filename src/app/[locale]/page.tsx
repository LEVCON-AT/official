import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import LevconPage from '@/components/LevconPage';
import type { Metadata } from 'next';

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
    authors: [{ name: 'Enric Bruns' }],
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
    },
    twitter: {
      card: 'summary',
      title: t('og_title'),
      description: t('og_description'),
    },
  };
}

export default async function LocalePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LevconPage locale={locale} />;
}

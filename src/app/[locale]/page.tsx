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

  const baseUrl = 'https://levcon.ai';

  // Schema.org structured data
  const schemaOrg = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfessionalService',
        name: 'Levcon.ai',
        description: locale === 'de'
          ? 'KI-Beratung und Schulungen für Unternehmen. KI mit Methode, Wirkung mit System.'
          : 'AI consulting and training for companies. AI with Method, Impact with System.',
        url: baseUrl,
        founder: {
          '@type': 'Person',
          name: 'Mst. Enric-Bernard Sep-Albi, BA, MBA',
          jobTitle: locale === 'de' ? 'KI-Trainer und Organisationsentwickler' : 'AI Trainer and Organisational Developer',
        },
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Pfalzgasse 37/2/4',
          addressLocality: 'Wien',
          postalCode: '1220',
          addressCountry: 'AT',
        },
        areaServed: ['AT', 'DE', 'CH'],
        availableLanguage: ['de', 'en'],
        email: 'hello@levcon.ai',
        sameAs: ['https://levcon.at'],
        serviceType: locale === 'de'
          ? ['KI-Beratung', 'KI-Schulungen', 'Datenschutz-Beratung', 'Prozessautomatisierung']
          : ['AI Consulting', 'AI Training', 'Privacy Consulting', 'Process Automation'],
      },
      {
        '@type': 'FAQPage',
        mainEntity: locale === 'de'
          ? [
              { '@type': 'Question', name: 'Brauchen wir schon KI-Erfahrung im Team?', acceptedAnswer: { '@type': 'Answer', text: 'Nein — und oft ist weniger Vorwissen sogar hilfreicher. Wir beginnen dort, wo Ihr Team steht, nicht dort, wo Lehrbücher anfangen.' } },
              { '@type': 'Question', name: 'Gibt es fixe Schulungspakete?', acceptedAnswer: { '@type': 'Answer', text: 'Nein. Jede Schulung beginnt mit einem Gespräch über Ihre Situation. Format, Dauer, Inhalt und Beispiele werden gemeinsam definiert.' } },
              { '@type': 'Question', name: 'Wie wird der Erfolg eines Projekts gemessen?', acceptedAnswer: { '@type': 'Answer', text: 'Die Metriken legen wir vor Projektstart gemeinsam fest. Kein Projekt endet ohne messbare Baseline.' } },
              { '@type': 'Question', name: 'Was kostet eine Schulung oder Beratung?', acceptedAnswer: { '@type': 'Answer', text: 'Ein erstes Gespräch ist kostenlos — danach erhalten Sie ein konkretes Angebot.' } },
              { '@type': 'Question', name: 'Arbeiten Sie nur mit großen Unternehmen?', acceptedAnswer: { '@type': 'Answer', text: 'Nein. Entscheidend ist, ob das Ziel klar ist.' } },
              { '@type': 'Question', name: 'Verkaufen Sie auch Software oder Tools?', acceptedAnswer: { '@type': 'Answer', text: 'Nein. Ich bin werkzeugunabhängig.' } },
              { '@type': 'Question', name: 'Wie läuft ein erstes Gespräch ab?', acceptedAnswer: { '@type': 'Answer', text: '30 Minuten, unverbindlich, ohne Agenda-Zwang.' } },
            ]
          : [
              { '@type': 'Question', name: 'Does our team need prior AI experience?', acceptedAnswer: { '@type': 'Answer', text: 'No — less prior knowledge is often actually better. We start where your team is.' } },
              { '@type': 'Question', name: 'Are there fixed training packages?', acceptedAnswer: { '@type': 'Answer', text: 'No. Every training is individually designed.' } },
              { '@type': 'Question', name: 'How is the success of a project measured?', acceptedAnswer: { '@type': 'Answer', text: 'We define the metrics together before the project starts.' } },
              { '@type': 'Question', name: 'What does a training or consulting engagement cost?', acceptedAnswer: { '@type': 'Answer', text: 'A first conversation is free — after that you get a concrete proposal.' } },
              { '@type': 'Question', name: 'Do you only work with large companies?', acceptedAnswer: { '@type': 'Answer', text: 'No. What matters is whether the goal is clear.' } },
              { '@type': 'Question', name: 'Do you sell software or tools?', acceptedAnswer: { '@type': 'Answer', text: 'No. I am tool-independent.' } },
              { '@type': 'Question', name: 'How does a first conversation work?', acceptedAnswer: { '@type': 'Answer', text: '30 minutes, non-binding, no agenda pressure.' } },
            ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
      />
      <LevconPage locale={locale} />
      <noscript>
        <div className="noscript-msg">
          {locale === 'de'
            ? 'Diese Website benötigt JavaScript für die Navigation. Bitte aktivieren Sie JavaScript in Ihrem Browser.'
            : 'This website requires JavaScript for navigation. Please enable JavaScript in your browser.'}
        </div>
      </noscript>
    </>
  );
}

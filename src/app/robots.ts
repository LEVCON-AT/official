import type { MetadataRoute } from 'next';

/**
 * Dynamic robots.txt generator.
 *
 * Uses Next.js Metadata API (robots() function) — generates /robots.txt
 * at build time based on the NEXT_PUBLIC_ENVIRONMENT variable.
 *
 * Production (NEXT_PUBLIC_ENVIRONMENT !== 'staging'):
 *   - Allow all crawlers
 *   - Reference sitemap.xml
 *
 * Staging (NEXT_PUBLIC_ENVIRONMENT === 'staging'):
 *   - Disallow all crawlers (Staging darf nicht in Google indexiert werden)
 *   - No sitemap reference
 *   - Zusätzliche Absicherung neben nginx X-Robots-Tag Header
 *
 * Standards (per QUALITY-GUIDELINES.md):
 *  - RFC 9309 (robots.txt Standard)
 *  - Environment-basiert (keine Hardcodierung)
 */
export default function robots(): MetadataRoute.Robots {
  const isStaging = process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging';

  // Staging: ALLE Crawler ausschließen
  if (isStaging) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
      // No sitemap on staging (würde auf staging.levcon.ai zeigen, nicht relevant)
    };
  }

  // Production: Alle Crawler erlauben, Sitemap referenzieren
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: 'https://levcon.ai/sitemap.xml',
    host: 'https://levcon.ai',
  };
}

import type { MetadataRoute } from 'next';
import { DE_SLUGS, EN_SLUGS, type PanelId } from '@/components/panel-routing';

const BASE_URL = 'https://levcon.ai';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/en`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  // Add all panel pages (DE)
  for (const panelId of Object.keys(DE_SLUGS) as PanelId[]) {
    const slug = DE_SLUGS[panelId];
    const priority = panelId === 'ainews' ? 0.9 : panelId === 'datenschutz' || panelId === 'impressum' ? 0.3 : 0.7;
    const changeFreq = panelId === 'ainews' ? 'daily' : 'monthly';
    entries.push({
      url: `${BASE_URL}/${slug}`,
      lastModified: new Date(),
      changeFrequency: changeFreq as 'daily' | 'monthly',
      priority,
    });
  }

  // Add all panel pages (EN)
  for (const panelId of Object.keys(EN_SLUGS) as PanelId[]) {
    const slug = EN_SLUGS[panelId];
    const priority = panelId === 'ainews' ? 0.8 : panelId === 'datenschutz' || panelId === 'impressum' ? 0.3 : 0.6;
    const changeFreq = panelId === 'ainews' ? 'daily' : 'monthly';
    entries.push({
      url: `${BASE_URL}/en/${slug}`,
      lastModified: new Date(),
      changeFrequency: changeFreq as 'daily' | 'monthly',
      priority,
    });
  }

  return entries;
}

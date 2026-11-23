import type { MetadataRoute } from 'next'
import { PORTAL_URL } from '@agiliza/ui'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: PORTAL_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${PORTAL_URL}/privacidade`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${PORTAL_URL}/termos`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${PORTAL_URL}/contato`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
}

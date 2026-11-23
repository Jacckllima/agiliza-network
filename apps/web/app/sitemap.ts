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
  ]
}

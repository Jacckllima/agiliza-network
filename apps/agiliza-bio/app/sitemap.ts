import type { MetadataRoute } from 'next'
import { TOOL_URLS } from '@agiliza/ui'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: TOOL_URLS.bio,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}

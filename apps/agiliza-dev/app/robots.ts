import type { MetadataRoute } from 'next'
import { TOOL_URLS } from '@agiliza/ui'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${TOOL_URLS.dev}/sitemap.xml`,
  }
}

import type { MetadataRoute } from 'next'
import { PORTAL_URL } from '@agiliza/ui'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${PORTAL_URL}/sitemap.xml`,
  }
}

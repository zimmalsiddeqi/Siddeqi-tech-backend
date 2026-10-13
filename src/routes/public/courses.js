// ============================================
// Public Course Routes — No authentication required
// ============================================

import {
  listPublishedCourses,
  getFeaturedCourses,
  getCourseBySlug
} from '../../services/courseService.js'
import { listPublishedPackages } from '../../services/packageService.js'
import { listCoursesSchema, getCourseBySlugSchema } from '../../schemas/courseSchemas.js'
import { successResponse } from '../../utils/helpers.js'
import { publicCache } from '../../utils/cache.js'

export default async function publicCourseRoutes(fastify) {

  // GET /api/courses — List all published courses
  fastify.get('/api/courses', {
    schema: listCoursesSchema
  }, async (request, reply) => {
    const cacheKey = `courses:${JSON.stringify(request.query || {})}`
    const cached = publicCache.get(cacheKey)
    if (cached) {
      reply.header('X-Cache', 'HIT')
      reply.header('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300')
      return reply.send(cached)
    }

    const result = await listPublishedCourses(fastify.supabase, request.query)
    const payload = successResponse(result.courses, result.pagination)
    publicCache.set(cacheKey, payload, 120)

    reply.header('X-Cache', 'MISS')
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300')
    return reply.send(payload)
  })

  // GET /api/courses/featured — Featured courses for homepage
  fastify.get('/api/courses/featured', async (request, reply) => {
    const cacheKey = 'courses:featured'
    const cached = publicCache.get(cacheKey)
    if (cached) {
      reply.header('X-Cache', 'HIT')
      reply.header('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300')
      return reply.send(cached)
    }

    const courses = await getFeaturedCourses(fastify.supabase)
    const payload = successResponse(courses)
    publicCache.set(cacheKey, payload, 120)

    reply.header('X-Cache', 'MISS')
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300')
    return reply.send(payload)
  })

  // GET /api/courses/:slug — Single course details
  fastify.get('/api/courses/:slug', {
    schema: getCourseBySlugSchema
  }, async (request, reply) => {
    const cacheKey = `course:${request.params.slug}`
    const cached = publicCache.get(cacheKey)
    if (cached) {
      reply.header('X-Cache', 'HIT')
      reply.header('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300')
      return reply.send(cached)
    }

    const course = await getCourseBySlug(fastify.supabase, request.params.slug)
    const payload = successResponse(course)
    publicCache.set(cacheKey, payload, 120)

    reply.header('X-Cache', 'MISS')
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300')
    return reply.send(payload)
  })

  // GET /api/packages — Published packages
  fastify.get('/api/packages', async (request, reply) => {
    const cacheKey = 'packages:list'
    const cached = publicCache.get(cacheKey)
    if (cached) {
      reply.header('X-Cache', 'HIT')
      reply.header('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300')
      return reply.send(cached)
    }

    const packages = await listPublishedPackages(fastify.supabase)
    const payload = successResponse(packages)
    publicCache.set(cacheKey, payload, 120)

    reply.header('X-Cache', 'MISS')
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300')
    return reply.send(payload)
  })

  // GET /api/sitemap.xml — Dynamic XML sitemap for search engines
  fastify.get('/api/sitemap.xml', async (request, reply) => {
    const cachedXml = publicCache.get('sitemap:xml')
    if (cachedXml) {
      reply.header('Content-Type', 'application/xml; charset=utf-8')
      reply.header('Cache-Control', 'public, max-age=3600, s-maxage=86400')
      return reply.send(cachedXml)
    }

    const { data: courses } = await fastify.supabase
      .from('courses')
      .select('slug, updated_at')
      .eq('status', 'published')

    const siteUrl = 'https://shawkattech.vercel.app'
    const today = new Date().toISOString().split('T')[0]

    const urls = [
      `  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
      `  <url>\n    <loc>${siteUrl}/courses</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>`,
      `  <url>\n    <loc>${siteUrl}/packages</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    ]

    if (courses && courses.length > 0) {
      courses.forEach((c) => {
        const lastMod = c.updated_at ? c.updated_at.split('T')[0] : today
        urls.push(
          `  <url>\n    <loc>${siteUrl}/courses/${c.slug}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n  </url>`
        )
      })
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`

    publicCache.set('sitemap:xml', xml, 1800)
    reply.header('Content-Type', 'application/xml; charset=utf-8')
    reply.header('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    return reply.send(xml)
  })
}
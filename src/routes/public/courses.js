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
}
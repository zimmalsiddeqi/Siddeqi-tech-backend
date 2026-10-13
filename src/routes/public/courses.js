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

export default async function publicCourseRoutes(fastify) {

  // GET /api/courses — List all published courses
  fastify.get('/api/courses', {
    schema: listCoursesSchema
  }, async (request, reply) => {
    const result = await listPublishedCourses(fastify.supabase, request.query)
    return reply.send(successResponse(result.courses, result.pagination))
  })

  // GET /api/courses/featured — Featured courses for homepage
  fastify.get('/api/courses/featured', async (request, reply) => {
    const courses = await getFeaturedCourses(fastify.supabase)
    return reply.send(successResponse(courses))
  })

  // GET /api/courses/:slug — Single course details
  fastify.get('/api/courses/:slug', {
    schema: getCourseBySlugSchema
  }, async (request, reply) => {
    const course = await getCourseBySlug(fastify.supabase, request.params.slug)
    return reply.send(successResponse(course))
  })

  // GET /api/packages — Published packages
  fastify.get('/api/packages', async (request, reply) => {
    const packages = await listPublishedPackages(fastify.supabase)
    return reply.send(successResponse(packages))
  })
}
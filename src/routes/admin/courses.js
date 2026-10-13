// ============================================
// Admin Course Routes
// ============================================

import {
  listAllCourses,
  createCourse,
  updateCourse,
  archiveCourse
} from '../../services/courseService.js'
import {
  listCoursesSchema,
  createCourseSchema,
  updateCourseSchema,
  deleteCourseSchema
} from '../../schemas/courseSchemas.js'
import { successResponse } from '../../utils/helpers.js'

export default async function adminCourseRoutes(fastify) {

  // All admin routes require auth + admin role
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply)
    await fastify.requireAdmin(request, reply)
  })

  // GET /api/admin/courses — List all courses (including drafts)
  fastify.get('/api/admin/courses', {
    schema: listCoursesSchema
  }, async (request, reply) => {
    const result = await listAllCourses(fastify.supabase, request.query)
    return reply.send(successResponse(result.courses, result.pagination))
  })

  // POST /api/admin/courses — Create course
  fastify.post('/api/admin/courses', {
    schema: createCourseSchema
  }, async (request, reply) => {
    const course = await createCourse(fastify.supabase, request.body, request.user.id)
    return reply.status(201).send(successResponse(course))
  })

  // PATCH /api/admin/courses/:id — Update course
  fastify.patch('/api/admin/courses/:id', {
    schema: updateCourseSchema
  }, async (request, reply) => {
    const course = await updateCourse(fastify.supabase, request.params.id, request.body)
    return reply.send(successResponse(course))
  })

  // DELETE /api/admin/courses/:id — Archive course (soft delete)
  fastify.delete('/api/admin/courses/:id', {
    schema: deleteCourseSchema
  }, async (request, reply) => {
    const course = await archiveCourse(fastify.supabase, request.params.id)
    return reply.send(successResponse(course))
  })
}
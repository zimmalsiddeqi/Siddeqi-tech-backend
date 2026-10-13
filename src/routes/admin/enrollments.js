// ============================================
// Admin Enrollment Routes
// ============================================

import {
  listAllEnrollments,
  getCourseEnrollments,
  updateEnrollmentStatus
} from '../../services/enrollmentService.js'
import {
  listEnrollmentsSchema,
  updateEnrollmentSchema,
  courseEnrollmentsSchema
} from '../../schemas/enrollmentSchemas.js'
import { successResponse } from '../../utils/helpers.js'

export default async function adminEnrollmentRoutes(fastify) {

  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply)
    await fastify.requireAdmin(request, reply)
  })

  // GET /api/admin/enrollments — All enrollments
  fastify.get('/api/admin/enrollments', {
    schema: listEnrollmentsSchema
  }, async (request, reply) => {
    const result = await listAllEnrollments(fastify.supabase, request.query)
    return reply.send(successResponse(result.enrollments, result.pagination))
  })

  // GET /api/admin/courses/:id/enrollments — Course-specific enrollments
  fastify.get('/api/admin/courses/:id/enrollments', {
    schema: courseEnrollmentsSchema
  }, async (request, reply) => {
    const result = await getCourseEnrollments(
      fastify.supabase,
      request.params.id,
      request.query
    )
    return reply.send(successResponse(result.enrollments, result.pagination))
  })

  // PATCH /api/admin/enrollments/:id — Approve/reject enrollment
  fastify.patch('/api/admin/enrollments/:id', {
    schema: updateEnrollmentSchema
  }, async (request, reply) => {
    const enrollment = await updateEnrollmentStatus(
      fastify.supabase,
      request.params.id,
      request.body,
      request.user.id
    )
    return reply.send(successResponse(enrollment))
  })
}
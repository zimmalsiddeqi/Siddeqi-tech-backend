// ============================================
// Student Enrollment Routes
// ============================================

import { createEnrollment, getStudentEnrollments } from '../../services/enrollmentService.js'
import { createEnrollmentSchema } from '../../schemas/enrollmentSchemas.js'
import { successResponse } from '../../utils/helpers.js'

export default async function studentEnrollmentRoutes(fastify) {

  fastify.addHook('onRequest', fastify.authenticate)

  // POST /api/enrollments — Submit enrollment request
  fastify.post('/api/enrollments', {
    schema: createEnrollmentSchema,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const enrollment = await createEnrollment(
      fastify.supabase,
      request.user.id,
      request.body
    )
    return reply.status(201).send(successResponse(enrollment))
  })

  // GET /api/me/enrollments — Student's enrollments
  fastify.get('/api/me/enrollments', async (request, reply) => {
    const enrollments = await getStudentEnrollments(fastify.supabase, request.user.id)
    return reply.send(successResponse(enrollments))
  })
}
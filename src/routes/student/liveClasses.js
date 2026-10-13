// ============================================
// Student Live Class Routes
// ============================================

import { getStudentLiveClasses, verifyClassAccess } from '../../services/liveClassService.js'
import { generateToken } from '../../services/livekitService.js'
import { liveClassParamsSchema } from '../../schemas/liveClassSchemas.js'
import { successResponse } from '../../utils/helpers.js'

export default async function studentLiveClassRoutes(fastify) {

  fastify.addHook('onRequest', fastify.authenticate)

  // GET /api/me/live-classes — Student's authorized live classes
  fastify.get('/api/me/live-classes', async (request, reply) => {
    const classes = await getStudentLiveClasses(fastify.supabase, request.user.id)
    return reply.send(successResponse(classes))
  })

    // POST /api/live-classes/:id/join-token — Get LiveKit room token
  fastify.post('/api/live-classes/:id/join-token', {
    schema: liveClassParamsSchema
  }, async (request, reply) => {
    const liveClass = await verifyClassAccess(
      fastify.supabase,
      request.user.id,
      request.params.id,
      request.user.role // pass user role
    )

    const isInstructor = ['admin', 'instructor'].includes(request.user.role)

    const token = await generateToken(
      liveClass.provider_room_id,
      request.user.id,
      request.user.full_name,
      isInstructor
    )

    return reply.send(successResponse({
      token,
      room_id: liveClass.provider_room_id,
      livekit_url: process.env.LIVEKIT_URL
    }))
  })
}
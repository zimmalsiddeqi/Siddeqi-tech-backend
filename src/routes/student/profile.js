// ============================================
// Student Profile Routes
// ============================================

import { getProfile, updateProfile } from '../../services/profileService.js'
import { getProfileSchema, updateProfileSchema } from '../../schemas/profileSchemas.js'
import { successResponse } from '../../utils/helpers.js'

export default async function profileRoutes(fastify) {

  // All routes require authentication
  fastify.addHook('onRequest', fastify.authenticate)

  // GET /api/me — Get current user profile
  fastify.get('/api/me', {
    schema: getProfileSchema
  }, async (request, reply) => {
    const profile = await getProfile(fastify.supabase, request.user.id)
    return reply.send(successResponse(profile))
  })

  // PATCH /api/me — Update profile
  fastify.patch('/api/me', {
    schema: updateProfileSchema
  }, async (request, reply) => {
    const profile = await updateProfile(fastify.supabase, request.user.id, request.body)
    return reply.send(successResponse(profile))
  })
}
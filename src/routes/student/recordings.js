// ============================================
// Student Recording Routes
// ============================================

import { getStudentRecordings, getPlaybackAccess } from '../../services/recordingService.js'
import { listRecordingsSchema, playbackAccessSchema } from '../../schemas/recordingSchemas.js'
import { successResponse } from '../../utils/helpers.js'

export default async function studentRecordingRoutes(fastify) {

  fastify.addHook('onRequest', fastify.authenticate)

  // GET /api/me/recordings — Student's authorized recordings
  fastify.get('/api/me/recordings', {
    schema: listRecordingsSchema
  }, async (request, reply) => {
    const result = await getStudentRecordings(
      fastify.supabase,
      request.user.id,
      request.query
    )
    return reply.send(successResponse(result.recordings, result.pagination))
  })

  // POST /api/recordings/:id/playback-access — Get signed playback URL
  fastify.post('/api/recordings/:id/playback-access', {
    schema: playbackAccessSchema
  }, async (request, reply) => {
    const playback = await getPlaybackAccess(
      fastify.supabase,
      request.user.id,
      request.params.id
    )
    return reply.send(successResponse(playback))
  })
}
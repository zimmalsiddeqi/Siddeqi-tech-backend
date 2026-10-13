// ============================================
// Admin Recording Routes
// ============================================

import {
  listAllRecordings,
  publishRecording,
  unpublishRecording,
  deleteRecording
} from '../../services/recordingService.js'
import {
  listRecordingsSchema,
  publishRecordingSchema,
  recordingParamsSchema
} from '../../schemas/recordingSchemas.js'
import { successResponse } from '../../utils/helpers.js'

export default async function adminRecordingRoutes(fastify) {

  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply)
    await fastify.requireAdmin(request, reply)
  })

  // GET /api/admin/recordings — All recordings
  fastify.get('/api/admin/recordings', {
    schema: listRecordingsSchema
  }, async (request, reply) => {
    const result = await listAllRecordings(fastify.supabase, request.query)
    return reply.send(successResponse(result.recordings, result.pagination))
  })

  // PATCH /api/admin/recordings/:id/publish — Publish recording
  fastify.patch('/api/admin/recordings/:id/publish', {
    schema: publishRecordingSchema
  }, async (request, reply) => {
    const recording = await publishRecording(
      fastify.supabase,
      request.params.id,
      request.body
    )
    return reply.send(successResponse(recording))
  })

  // PATCH /api/admin/recordings/:id/unpublish — Unpublish recording
  fastify.patch('/api/admin/recordings/:id/unpublish', {
    schema: recordingParamsSchema
  }, async (request, reply) => {
    const recording = await unpublishRecording(fastify.supabase, request.params.id)
    return reply.send(successResponse(recording))
  })

  // DELETE /api/admin/recordings/:id — Delete recording
  fastify.delete('/api/admin/recordings/:id', {
    schema: recordingParamsSchema
  }, async (request, reply) => {
    const result = await deleteRecording(fastify.supabase, request.params.id)
    return reply.send(successResponse(result))
  })
}
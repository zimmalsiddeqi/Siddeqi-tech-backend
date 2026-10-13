// ============================================
// Admin Live Class Routes
// ============================================

import {
  createLiveClass,
  updateLiveClass,
  startLiveClass,
  endLiveClass,
  cancelLiveClass,
  listAllLiveClasses
} from '../../services/liveClassService.js'
import { createRoom, deleteRoom, generateToken, startRecording, stopRecording, listParticipants } from '../../services/livekitService.js'
import { createRecordingRecord, updateRecordingStatus, syncPendingRecordings } from '../../services/recordingService.js'
import {
  createLiveClassSchema,
  updateLiveClassSchema,
  liveClassParamsSchema,
  listLiveClassesSchema
} from '../../schemas/liveClassSchemas.js'
import { successResponse } from '../../utils/helpers.js'
// Add this import at the top of server/src/routes/admin/liveClasses.js
import { BadRequestError } from '../../utils/errors.js'
export default async function adminLiveClassRoutes(fastify) {

  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply)
    await fastify.requireAdmin(request, reply)
  })

  // GET /api/admin/live-classes — List all classes
  fastify.get('/api/admin/live-classes', {
    schema: listLiveClassesSchema
  }, async (request, reply) => {
    const result = await listAllLiveClasses(fastify.supabase, request.query)
    return reply.send(successResponse(result.classes, result.pagination))
  })

  // POST /api/admin/live-classes — Create class
  fastify.post('/api/admin/live-classes', {
    schema: createLiveClassSchema
  }, async (request, reply) => {
    const liveClass = await createLiveClass(
      fastify.supabase,
      request.body,
      request.user.id
    )
    return reply.status(201).send(successResponse(liveClass))
  })

  // PATCH /api/admin/live-classes/:id — Update scheduled class
  fastify.patch('/api/admin/live-classes/:id', {
    schema: updateLiveClassSchema
  }, async (request, reply) => {
    const liveClass = await updateLiveClass(
      fastify.supabase,
      request.params.id,
      request.body
    )
    return reply.send(successResponse(liveClass))
  })

  // POST /api/admin/live-classes/:id/start — Start class + create LiveKit room
  fastify.post('/api/admin/live-classes/:id/start', {
    schema: liveClassParamsSchema
  }, async (request, reply) => {
    const liveClass = await startLiveClass(fastify.supabase, request.params.id)

    // Create LiveKit room
    await createRoom(liveClass.provider_room_id, liveClass.max_participants || 100)

    // Generate instructor token
    const token = await generateToken(
      liveClass.provider_room_id,
      request.user.id,
      request.user.full_name,
      true // isInstructor
    )

    return reply.send(successResponse({
      ...liveClass,
      token,
      livekit_url: process.env.LIVEKIT_URL
    }))
  })

  // POST /api/admin/live-classes/:id/end — End class + close room
  fastify.post('/api/admin/live-classes/:id/end', {
    schema: liveClassParamsSchema
  }, async (request, reply) => {
    const liveClass = await endLiveClass(fastify.supabase, request.params.id)

    // Delete LiveKit room
    await deleteRoom(liveClass.provider_room_id)

    return reply.send(successResponse(liveClass))
  })

  // POST /api/admin/live-classes/:id/cancel — Cancel class
  fastify.post('/api/admin/live-classes/:id/cancel', {
    schema: liveClassParamsSchema
  }, async (request, reply) => {
    const liveClass = await cancelLiveClass(fastify.supabase, request.params.id)
    return reply.send(successResponse(liveClass))
  })

  // POST /api/admin/live-classes/:id/recording/start — Start recording
    // POST /api/admin/live-classes/:id/recording/start — Start recording
  fastify.post('/api/admin/live-classes/:id/recording/start', {
    schema: liveClassParamsSchema
  }, async (request, reply) => {
    // Verify class is live
    const { data: liveClass, error: fetchErr } = await fastify.supabase
      .from('live_classes')
      .select('id, course_id, provider_room_id, status, title')
      .eq('id', request.params.id)
      .single()

    if (fetchErr || !liveClass) {
      throw new BadRequestError('Live class not found')
    }

    if (liveClass.status !== 'live') {
      throw new BadRequestError('Class must be launched (live) before recording can start')
    }

    // Safety guard: ensure instructor/participants are in the room before launching egress
    const participants = await listParticipants(liveClass.provider_room_id)
    if (!participants || participants.length === 0) {
      throw new BadRequestError('Cannot start recording an empty classroom. Please enter the classroom with your camera/microphone enabled first.')
    }

    // Start LiveKit recording
    const egressResult = await startRecording(liveClass.provider_room_id)

    // Create recording record in database
    const recording = await createRecordingRecord(fastify.supabase, {
      course_id: liveClass.course_id,
      live_class_id: liveClass.id,
      title: liveClass.title,
      provider_recording_id: egressResult.egress_id
    })

    return reply.status(201).send(successResponse(recording))
  })
  // POST /api/admin/live-classes/:id/recording/stop — Stop recording
  fastify.post('/api/admin/live-classes/:id/recording/stop', {
    schema: liveClassParamsSchema
  }, async (request, reply) => {
    // Find active, starting, or processing recording for this class
    let { data: recording } = await fastify.supabase
      .from('recordings')
      .select('id, provider_recording_id, processing_status')
      .eq('live_class_id', request.params.id)
      .in('processing_status', ['starting', 'recording', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!recording) {
      // Check latest recording for this class
      const { data: latest } = await fastify.supabase
        .from('recordings')
        .select('id, provider_recording_id, processing_status')
        .eq('live_class_id', request.params.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      recording = latest
    }

    if (!recording) {
      throw new BadRequestError('No recording found for this class')
    }

    // Stop LiveKit recording gracefully
    if (recording.provider_recording_id) {
      await stopRecording(recording.provider_recording_id).catch(() => {})
    }

    // Update status to processing if it was starting or recording
    let updated = recording
    if (['starting', 'recording'].includes(recording.processing_status)) {
      updated = await updateRecordingStatus(fastify.supabase, recording.id, {
        processing_status: 'processing'
      })
    }

    // Auto-sync status with LiveKit Cloud
    await syncPendingRecordings(fastify.supabase).catch(() => {})

    return reply.send(successResponse(updated))
  })
}
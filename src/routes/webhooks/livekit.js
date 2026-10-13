// ============================================
// LiveKit Webhook Routes
// ============================================

import { handleRecordingWebhook } from '../../services/recordingService.js'
import { WebhookReceiver } from 'livekit-server-sdk'

export default async function livekitWebhookRoutes(fastify) {

  const receiver = new WebhookReceiver(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
  )

  // POST /api/webhooks/livekit
  fastify.post('/api/webhooks/livekit', {
    config: {
      rateLimit: false
    }
  }, async (request, reply) => {
    try {
      const authHeader = request.headers.authorization
      const body = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body)

      const event = await receiver.receive(body, authHeader)

      fastify.log.info({ event: event.event }, 'LiveKit webhook received')

      // Process egress (recording) events
      if (event.event && event.event.startsWith('egress_')) {
        await handleRecordingWebhook(fastify.supabase, event)
      }

      // Process participant events for attendance
      if (event.event === 'participant_joined' || event.event === 'participant_left') {
        await handleAttendanceEvent(fastify.supabase, event)
      }

      return reply.status(200).send({ received: true })
    } catch (error) {
      fastify.log.error({ err: error }, 'LiveKit webhook error')
      return reply.status(401).send({ error: 'Invalid webhook' })
    }
  })
}

// Handle attendance from LiveKit participant events
async function handleAttendanceEvent(supabase, event) {
  const { participant, room } = event

  if (!participant || !room) return

  const studentId = participant.identity

  const { data: liveClass } = await supabase
    .from('live_classes')
    .select('id')
    .eq('provider_room_id', room.name)
    .maybeSingle()

  if (!liveClass) return

  if (event.event === 'participant_joined') {
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('live_class_id', liveClass.id)
      .eq('student_id', studentId)
      .maybeSingle()

    if (!existing) {
      await supabase.from('attendance').insert({
        live_class_id: liveClass.id,
        student_id: studentId,
        joined_at: new Date().toISOString(),
        status: 'present',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    } else {
      await supabase
        .from('attendance')
        .update({
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    }
  }

  if (event.event === 'participant_left') {
    const { data: record } = await supabase
      .from('attendance')
      .select('id, joined_at')
      .eq('live_class_id', liveClass.id)
      .eq('student_id', studentId)
      .maybeSingle()

    if (record) {
      const joinedAt = new Date(record.joined_at)
      const leftAt = new Date()
      const attendedSeconds = Math.round((leftAt - joinedAt) / 1000)

      await supabase
        .from('attendance')
        .update({
          left_at: leftAt.toISOString(),
          attended_seconds: attendedSeconds,
          updated_at: leftAt.toISOString()
        })
        .eq('id', record.id)
    }
  }
}
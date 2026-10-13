// ============================================
// Recording Service — Recording metadata & playback
// ============================================

import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js'
import { paginate, paginationMeta } from '../utils/helpers.js'
import { getEgressClient } from './livekitService.js'

const RECORDING_COLUMNS = `
  id, course_id, live_class_id, title, description,
  provider_recording_id, storage_key, duration_seconds,
  file_size_bytes, processing_status, publication_status,
  allow_download, lesson_order, published_at,
  created_at, updated_at
`

/**
 * Auto-sync pending recordings directly with LiveKit Cloud (guarantees real-time updates even without webhooks)
 */
export async function syncPendingRecordings(supabase) {
  try {
    const { data: pending } = await supabase
      .from('recordings')
      .select('id, provider_recording_id, processing_status, storage_key')
      .or('processing_status.in.(starting,recording,processing),storage_key.is.null,storage_key.eq.""')
      .not('provider_recording_id', 'is', null)

    if (!pending || pending.length === 0) return

    const egressClient = getEgressClient()

    for (const rec of pending) {
      const list = await egressClient.listEgress({ egressId: rec.provider_recording_id })
      const info = list?.[0]
      if (!info) continue

      const status = info.status
      if (status === 1 || status === 'EGRESS_ACTIVE') {
        if (rec.processing_status !== 'recording') {
          await supabase.from('recordings').update({
            processing_status: 'recording',
            updated_at: new Date().toISOString()
          }).eq('id', rec.id)
        }
      } else if (status === 2 || status === 'EGRESS_ENDING') {
        if (rec.processing_status !== 'processing') {
          await supabase.from('recordings').update({
            processing_status: 'processing',
            updated_at: new Date().toISOString()
          }).eq('id', rec.id)
        }
      } else if (status === 3 || status === 'EGRESS_COMPLETE') {
        const jsonInfo = typeof info.toJson === 'function' ? info.toJson() : info
        const file = (info.result?.case === 'file' ? info.result.value : null)
          || jsonInfo.file
          || jsonInfo.fileResults?.[0]
          || info.fileResults?.[0]

        const rawKey = file?.filename || file?.location || jsonInfo.roomComposite?.file?.filepath || ''
        const cleanKey = rawKey.replace(/^recordings\//, '')

        await supabase.from('recordings').update({
          processing_status: 'ready',
          storage_key: cleanKey,
          file_size_bytes: Number(file?.size) || 0,
          duration_seconds: file?.duration ? Math.round(Number(file.duration) / 1e9) : null,
          updated_at: new Date().toISOString()
        }).eq('id', rec.id)
      } else if (status === 4 || status === 5 || status === 6 || status === 'EGRESS_FAILED' || status === 'EGRESS_ABORTED' || status === 'EGRESS_LIMIT_REACHED') {
        await supabase.from('recordings').update({
          processing_status: 'failed',
          updated_at: new Date().toISOString()
        }).eq('id', rec.id)
      }
    }
  } catch (err) {
    console.warn('[RECORDING] LiveKit egress sync note:', err.message)
  }
}

// ---- Admin Operations ----

export async function createRecordingRecord(supabase, data) {
  const { data: recording, error } = await supabase
    .from('recordings')
    .insert({
      ...data,
      processing_status: 'starting',
      publication_status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select(RECORDING_COLUMNS)
    .single()

  if (error) {
    throw new BadRequestError(`Failed to create recording: ${error.message}`)
  }

  return recording
}

export async function updateRecordingStatus(supabase, recordingId, updates) {
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('recordings')
    .update(updates)
    .eq('id', recordingId)
    .select(RECORDING_COLUMNS)
    .single()

  if (error || !data) {
    throw new NotFoundError('Recording')
  }

  return data
}

export async function publishRecording(supabase, recordingId, publishData = {}) {
  // Sync pending recordings with LiveKit Cloud first (in case webhook was missed)
  await syncPendingRecordings(supabase)

  const { data: recording } = await supabase
    .from('recordings')
    .select('id, processing_status')
    .eq('id', recordingId)
    .single()

  if (!recording) {
    throw new NotFoundError('Recording')
  }

  if (recording.processing_status === 'failed') {
    throw new BadRequestError('Cannot publish recording: Video processing failed on LiveKit (no audio/video stream received)')
  }

  if (recording.processing_status !== 'ready') {
    throw new BadRequestError('Recording is still encoding in LiveKit Cloud. Please wait a moment and try again.')
  }

  const updates = {
    publication_status: 'published',
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  // Allow overriding title, description, order, download permission
  if (publishData.title) updates.title = publishData.title
  if (publishData.description) updates.description = publishData.description
  if (publishData.lesson_order !== undefined) updates.lesson_order = publishData.lesson_order
  if (publishData.allow_download !== undefined) updates.allow_download = publishData.allow_download

  const { data, error } = await supabase
    .from('recordings')
    .update(updates)
    .eq('id', recordingId)
    .select(RECORDING_COLUMNS)
    .single()

  if (error) {
    throw new BadRequestError('Failed to publish recording')
  }

  return data
}

export async function unpublishRecording(supabase, recordingId) {
  const { data, error } = await supabase
    .from('recordings')
    .update({
      publication_status: 'draft',
      published_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', recordingId)
    .select(RECORDING_COLUMNS)
    .single()

  if (error || !data) {
    throw new NotFoundError('Recording')
  }

  return data
}

export async function deleteRecording(supabase, recordingId) {
  const { data: recording } = await supabase
    .from('recordings')
    .select('id, storage_key')
    .eq('id', recordingId)
    .single()

  if (!recording) {
    throw new NotFoundError('Recording')
  }

  // Delete file from storage bucket if it exists
  if (recording.storage_key) {
    await supabase.storage
      .from(process.env.VIDEO_STORAGE_BUCKET || 'recordings')
      .remove([recording.storage_key.replace(/^recordings\//, '')])
      .catch(() => {})
  }

  const { error } = await supabase
    .from('recordings')
    .delete()
    .eq('id', recordingId)

  if (error) {
    throw new BadRequestError('Failed to delete recording')
  }

  return { id: recordingId, deleted: true }
}

export async function listAllRecordings(supabase, query = {}) {
  // Auto-sync any pending recordings with LiveKit Cloud
  await syncPendingRecordings(supabase)

  const { offset, limit, page } = paginate(query.page, query.per_page)

  let dbQuery = supabase
    .from('recordings')
    .select(`
      ${RECORDING_COLUMNS},
      courses:course_id (id, title, slug),
      live_classes:live_class_id (id, title)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.course_id) {
    dbQuery = dbQuery.eq('course_id', query.course_id)
  }
  if (query.publication_status) {
    dbQuery = dbQuery.eq('publication_status', query.publication_status)
  }
  if (query.processing_status) {
    dbQuery = dbQuery.eq('processing_status', query.processing_status)
  }

  const { data, count, error } = await dbQuery

  if (error) {
    throw new BadRequestError('Failed to fetch recordings')
  }

  return {
    recordings: data || [],
    pagination: paginationMeta(count || 0, page, limit)
  }
}

// ---- Student Operations ----

export async function getStudentRecordings(supabase, studentId, query = {}) {
  // Get accessible courses
  const { data: access } = await supabase
    .from('student_course_access')
    .select('course_id')
    .eq('student_id', studentId)
    .eq('is_active', true)

  if (!access || access.length === 0) {
    return { recordings: [], pagination: paginationMeta(0, 1, 20) }
  }

  const courseIds = access.map(a => a.course_id)
  const { offset, limit, page } = paginate(query.page, query.per_page)

  let dbQuery = supabase
    .from('recordings')
    .select(`
      ${RECORDING_COLUMNS},
      courses:course_id (id, title, slug)
    `, { count: 'exact' })
    .in('course_id', courseIds)
    .eq('publication_status', 'published')
    .order('lesson_order', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (query.course_id) {
    if (!courseIds.includes(query.course_id)) {
      throw new ForbiddenError('You do not have access to this course')
    }
    dbQuery = dbQuery.eq('course_id', query.course_id)
  }

  const { data, count, error } = await dbQuery

  if (error) {
    throw new BadRequestError('Failed to fetch recordings')
  }

  return {
    recordings: data || [],
    pagination: paginationMeta(count || 0, page, limit)
  }
}

export async function getPlaybackAccess(supabase, studentId, recordingId) {
  // Get recording details
  const { data: recording } = await supabase
    .from('recordings')
    .select('id, course_id, storage_key, publication_status, allow_download, provider_recording_id')
    .eq('id', recordingId)
    .single()

  if (!recording) {
    throw new NotFoundError('Recording')
  }

  if (recording.publication_status !== 'published') {
    throw new NotFoundError('Recording')
  }

  // Check if caller is admin or instructor (staff can preview any recording)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', studentId)
    .single()

  const isStaff = profile?.role === 'admin' || profile?.role === 'instructor'

  if (!isStaff) {
    // Verify student course access
    const { data: access } = await supabase
      .from('student_course_access')
      .select('id')
      .eq('student_id', studentId)
      .eq('course_id', recording.course_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!access) {
      throw new ForbiddenError('You do not have access to this recording')
    }
  }

  // Generate signed URL for playback
  let cleanKey = (recording.storage_key || '').replace(/^recordings\//, '')

  // If storage_key is missing, attempt on-the-fly sync with LiveKit Cloud
  if (!cleanKey && recording.provider_recording_id) {
    await syncPendingRecordings(supabase)
    const { data: refreshed } = await supabase
      .from('recordings')
      .select('id, storage_key')
      .eq('id', recordingId)
      .single()

    if (refreshed?.storage_key) {
      cleanKey = refreshed.storage_key.replace(/^recordings\//, '')
    }
  }

  if (cleanKey) {
    const { data: signedUrl, error } = await supabase
      .storage
      .from(process.env.VIDEO_STORAGE_BUCKET || 'recordings')
      .createSignedUrl(cleanKey, 3600) // 1 hour

    if (error) {
      throw new BadRequestError('Failed to generate playback URL')
    }

    return {
      recording_id: recording.id,
      playback_url: signedUrl.signedUrl,
      allow_download: recording.allow_download,
      expires_in: 3600
    }
  }

  throw new BadRequestError('Recording file is not available')
}

// ---- Webhook Processing ----

export async function handleRecordingWebhook(supabase, event) {
  const egressInfo = event.egressInfo || event

  if (!egressInfo || !egressInfo.egressId) {
    console.log('[WEBHOOK] No egress info in event')
    return
  }

  console.log('[WEBHOOK] Processing egress event:', egressInfo.egressId, 'Status:', egressInfo.status)

  // Find recording by provider_recording_id
  const { data: recording } = await supabase
    .from('recordings')
    .select('id, processing_status')
    .eq('provider_recording_id', egressInfo.egressId)
    .maybeSingle()

  if (!recording) {
    console.log('[WEBHOOK] No matching recording found for egress:', egressInfo.egressId)
    return
  }

  const status = egressInfo.status
  const updates = { updated_at: new Date().toISOString() }

  // Map LiveKit Egress status (handles both numeric enums and string names)
  // EgressStatus: 0=STARTING, 1=ACTIVE, 2=ENDING, 3=COMPLETE, 4=FAILED, 5=ABORTED
  const isStarting = status === 0 || status === 'EGRESS_STARTING'
  const isActive = status === 1 || status === 'EGRESS_ACTIVE'
  const isEnding = status === 2 || status === 'EGRESS_ENDING'
  const isComplete = status === 3 || status === 'EGRESS_COMPLETE'
  const isFailed = status === 4 || status === 5 || status === 6 || status === 'EGRESS_FAILED' || status === 'EGRESS_ABORTED' || status === 'EGRESS_LIMIT_REACHED'

  if (isStarting) {
    updates.processing_status = 'starting'
  } else if (isActive) {
    updates.processing_status = 'recording'
  } else if (isEnding) {
    updates.processing_status = 'processing'
  } else if (isComplete) {
    updates.processing_status = 'ready'

    // Extract file info from egress results (Protobuf oneof, json, or legacy results)
    const jsonInfo = typeof egressInfo.toJson === 'function' ? egressInfo.toJson() : egressInfo
    const file = (egressInfo.result?.case === 'file' ? egressInfo.result.value : null)
      || jsonInfo.file
      || jsonInfo.fileResults?.[0]
      || egressInfo.file
      || (egressInfo.fileResults && egressInfo.fileResults[0])

    if (file) {
      const rawKey = file.filename || file.location || jsonInfo.roomComposite?.file?.filepath || ''
      updates.storage_key = rawKey.replace(/^recordings\//, '')
      updates.file_size_bytes = Number(file.size) || 0
      if (file.duration) {
        updates.duration_seconds = Math.round(Number(file.duration) / 1e9)
      }
    }

    // Fallback to direct filepath from config
    if (!updates.storage_key && egressInfo.filepath) {
      updates.storage_key = egressInfo.filepath.replace(/^recordings\//, '')
    }

    console.log('[WEBHOOK] Recording ready:', recording.id, 'File:', updates.storage_key)
  } else if (isFailed) {
    updates.processing_status = 'failed'
    console.error('[WEBHOOK] Recording failed:', recording.id, egressInfo.error || status)
  } else {
    console.log('[WEBHOOK] Unhandled egress status:', status)
    return
  }

  const { error } = await supabase
    .from('recordings')
    .update(updates)
    .eq('id', recording.id)

  if (error) {
    console.error('[WEBHOOK] Failed to update recording:', error)
  } else {
    console.log('[WEBHOOK] Recording updated:', recording.id, '→', updates.processing_status)
  }
}
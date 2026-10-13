// ============================================
// Live Class Service — Scheduling & management
// ============================================

import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js'
import { generateRoomId, paginate, paginationMeta } from '../utils/helpers.js'

const CLASS_COLUMNS = `
  id, course_id, instructor_id, title, description,
  scheduled_start, scheduled_end, timezone, provider,
  provider_room_id, recording_enabled, chat_enabled,
  max_participants, status, started_at, ended_at,
  created_at, updated_at
`

// ---- Admin Operations ----

export async function createLiveClass(supabase, classData, instructorId) {
  // Verify course exists
  const { data: course } = await supabase
    .from('courses')
    .select('id, title')
    .eq('id', classData.course_id)
    .single()

  if (!course) {
    throw new NotFoundError('Course')
  }

  // Validate scheduled_end is after scheduled_start
  const start = new Date(classData.scheduled_start)
  const end = new Date(classData.scheduled_end)

  if (end <= start) {
    throw new BadRequestError('Scheduled end must be after scheduled start')
  }

  if (start <= new Date()) {
    throw new BadRequestError('Scheduled start must be in the future')
  }

  const roomId = generateRoomId()

  const { data, error } = await supabase
    .from('live_classes')
    .insert({
      ...classData,
      instructor_id: instructorId,
      provider: 'livekit',
      provider_room_id: roomId,
      status: 'scheduled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select(CLASS_COLUMNS)
    .single()

  if (error) {
    throw new BadRequestError(`Failed to create live class: ${error.message}`)
  }

  return data
}

export async function updateLiveClass(supabase, classId, updates) {
  // Only allow updates to scheduled classes
  const { data: existing } = await supabase
    .from('live_classes')
    .select('id, status')
    .eq('id', classId)
    .single()

  if (!existing) {
    throw new NotFoundError('Live class')
  }

  if (existing.status !== 'scheduled') {
    throw new BadRequestError(`Cannot update a ${existing.status} class`)
  }

  if (updates.scheduled_start && updates.scheduled_end) {
    const start = new Date(updates.scheduled_start)
    const end = new Date(updates.scheduled_end)
    if (end <= start) {
      throw new BadRequestError('Scheduled end must be after scheduled start')
    }
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('live_classes')
    .update(updates)
    .eq('id', classId)
    .select(CLASS_COLUMNS)
    .single()

  if (error) {
    throw new BadRequestError('Failed to update live class')
  }

  return data
}

export async function startLiveClass(supabase, classId) {
  const { data: existing, error: fetchErr } = await supabase
    .from('live_classes')
    .select('*')
    .eq('id', classId)
    .single()

  if (fetchErr || !existing) {
    throw new NotFoundError('Live class')
  }

  if (['completed', 'cancelled'].includes(existing.status)) {
    throw new BadRequestError(`Cannot start a ${existing.status} class`)
  }

  // Ensure room ID exists
  let roomId = existing.provider_room_id
  if (!roomId) {
    roomId = generateRoomId()
    await supabase
      .from('live_classes')
      .update({ provider_room_id: roomId })
      .eq('id', classId)
    existing.provider_room_id = roomId
  }

  // If already live, return existing without throwing an error
  if (existing.status === 'live') {
    return existing
  }

  const { data, error } = await supabase
    .from('live_classes')
    .update({
      status: 'live',
      provider_room_id: roomId,
      started_at: existing.started_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', classId)
    .select(CLASS_COLUMNS)
    .single()

  if (error) {
    throw new BadRequestError(`Failed to start live class: ${error.message}`)
  }

  return data
}

export async function endLiveClass(supabase, classId) {
  const { data: existing } = await supabase
    .from('live_classes')
    .select('id, status')
    .eq('id', classId)
    .single()

  if (!existing) {
    throw new NotFoundError('Live class')
  }

  if (existing.status !== 'live') {
    throw new BadRequestError(`Cannot end a ${existing.status} class`)
  }

  const { data, error } = await supabase
    .from('live_classes')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', classId)
    .select(CLASS_COLUMNS)
    .single()

  if (error) {
    throw new BadRequestError('Failed to end live class')
  }

  return data
}

export async function cancelLiveClass(supabase, classId) {
  const { data: existing } = await supabase
    .from('live_classes')
    .select('id, status')
    .eq('id', classId)
    .single()

  if (!existing) {
    throw new NotFoundError('Live class')
  }

  if (['completed', 'cancelled'].includes(existing.status)) {
    throw new BadRequestError(`Cannot cancel a ${existing.status} class`)
  }

  const { data, error } = await supabase
    .from('live_classes')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', classId)
    .select(CLASS_COLUMNS)
    .single()

  if (error) {
    throw new BadRequestError('Failed to cancel live class')
  }

  return data
}

// ---- Student Operations ----

export async function getStudentLiveClasses(supabase, studentId) {
  // Get courses the student has access to
  const { data: access } = await supabase
    .from('student_course_access')
    .select('course_id')
    .eq('student_id', studentId)
    .eq('is_active', true)

  if (!access || access.length === 0) {
    return []
  }

  const courseIds = access.map(a => a.course_id)

  const { data, error } = await supabase
    .from('live_classes')
    .select(`
      ${CLASS_COLUMNS},
      courses:course_id (id, title, slug)
    `)
    .in('course_id', courseIds)
    .in('status', ['scheduled', 'live'])
    .order('scheduled_start', { ascending: true })

  if (error) {
    throw new BadRequestError('Failed to fetch live classes')
  }

  return data || []
}

export async function verifyClassAccess(supabase, userId, classId, userRole = 'student') {
  const { data: liveClass, error } = await supabase
    .from('live_classes')
    .select('id, course_id, instructor_id, status, provider_room_id, title')
    .eq('id', classId)
    .single()

  if (error || !liveClass) {
    throw new NotFoundError('Live class')
  }

  if (liveClass.status !== 'live') {
    throw new BadRequestError('This class is not currently live')
  }

  // Admins, Instructors, or the designated instructor ALWAYS have access!
  if (['admin', 'instructor'].includes(userRole) || liveClass.instructor_id === userId) {
    return liveClass
  }

  // Check student course access
  const { data: access } = await supabase
    .from('student_course_access')
    .select('id')
    .eq('student_id', userId)
    .eq('course_id', liveClass.course_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!access) {
    throw new ForbiddenError('You do not have access to this class')
  }

  return liveClass
}

// ---- Admin List ----

export async function listAllLiveClasses(supabase, query = {}) {
  const { offset, limit, page } = paginate(query.page, query.per_page)

  let dbQuery = supabase
    .from('live_classes')
    .select(`
      ${CLASS_COLUMNS},
      courses:course_id (id, title, slug)
    `, { count: 'exact' })
    .order('scheduled_start', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status)
  }

  if (query.course_id) {
    dbQuery = dbQuery.eq('course_id', query.course_id)
  }

  const { data, count, error } = await dbQuery

  if (error) {
    throw new BadRequestError('Failed to fetch live classes')
  }

  return {
    classes: data || [],
    pagination: paginationMeta(count || 0, page, limit)
  }
}
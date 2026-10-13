// ============================================
// Enrollment Service — Enrollment + course access logic
// ============================================

import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../utils/errors.js'
import { paginate, paginationMeta } from '../utils/helpers.js'

// ---- Student Operations ----

export async function createEnrollment(supabase, studentId, enrollmentData) {
  const { course_id, package_id } = enrollmentData

  // Must provide exactly one
  if (!course_id && !package_id) {
    throw new BadRequestError('Either course_id or package_id is required')
  }
  if (course_id && package_id) {
    throw new BadRequestError('Provide either course_id or package_id, not both')
  }

  // Verify the course or package exists and is published
  if (course_id) {
    const { data: course } = await supabase
      .from('courses')
      .select('id, title, price, currency')
      .eq('id', course_id)
      .eq('status', 'published')
      .single()

    if (!course) {
      throw new NotFoundError('Course')
    }

    // Check for duplicate enrollment
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', studentId)
      .eq('course_id', course_id)
      .in('status', ['pending', 'approved'])
      .maybeSingle()

    if (existing) {
      throw new ConflictError(
        existing.status === 'pending'
          ? 'You already have a pending enrollment for this course'
          : 'You are already enrolled in this course'
      )
    }

    const { data, error } = await supabase
      .from('enrollments')
      .insert({
        student_id: studentId,
        course_id,
        package_id: null,
        status: 'pending',
        payment_status: 'pending',
        amount: course.price,
        currency: course.currency,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (error) {
      throw new BadRequestError(`Enrollment failed: ${error.message}`)
    }

    return data
  }

  // Package enrollment
  if (package_id) {
    const { data: pkg } = await supabase
      .from('course_packages')
      .select('id, name, price, currency')
      .eq('id', package_id)
      .eq('status', 'published')
      .single()

    if (!pkg) {
      throw new NotFoundError('Package')
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', studentId)
      .eq('package_id', package_id)
      .in('status', ['pending', 'approved'])
      .maybeSingle()

    if (existing) {
      throw new ConflictError(
        existing.status === 'pending'
          ? 'You already have a pending enrollment for this package'
          : 'You are already enrolled in this package'
      )
    }

    const { data, error } = await supabase
      .from('enrollments')
      .insert({
        student_id: studentId,
        course_id: null,
        package_id,
        status: 'pending',
        payment_status: 'pending',
        amount: pkg.price,
        currency: pkg.currency,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (error) {
      throw new BadRequestError(`Enrollment failed: ${error.message}`)
    }

    return data
  }
}

export async function getStudentEnrollments(supabase, studentId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id, status, payment_status, amount, currency, created_at, updated_at,
      courses:course_id (id, title, slug, banner_url, short_description),
      course_packages:package_id (id, name, slug, description)
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new BadRequestError('Failed to fetch enrollments')
  }

  return data || []
}

// ---- Admin Operations ----

export async function listAllEnrollments(supabase, query = {}) {
  const { offset, limit, page } = paginate(query.page, query.per_page)

  let dbQuery = supabase
    .from('enrollments')
    .select(`
      id, status, payment_status, amount, currency,
      approved_by, approved_at, created_at, updated_at,
      profiles:student_id (id, full_name, email, whatsapp),
      courses:course_id (id, title, slug),
      course_packages:package_id (id, name, slug)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status)
  }

  if (query.payment_status) {
    dbQuery = dbQuery.eq('payment_status', query.payment_status)
  }

  if (query.course_id) {
    dbQuery = dbQuery.eq('course_id', query.course_id)
  }

  if (query.search) {
    // Search by student name — requires a join filter
    dbQuery = dbQuery.or(`profiles.full_name.ilike.%${query.search}%,profiles.email.ilike.%${query.search}%`)
  }

  const { data, count, error } = await dbQuery

  if (error) {
    throw new BadRequestError('Failed to fetch enrollments')
  }

  return {
    enrollments: data || [],
    pagination: paginationMeta(count || 0, page, limit)
  }
}

export async function getCourseEnrollments(supabase, courseId, query = {}) {
  const { offset, limit, page } = paginate(query.page, query.per_page)

  let dbQuery = supabase
    .from('enrollments')
    .select(`
      id, status, payment_status, amount, currency, created_at,
      profiles:student_id (id, full_name, email, whatsapp)
    `, { count: 'exact' })
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status)
  }

  const { data, count, error } = await dbQuery

  if (error) {
    throw new BadRequestError('Failed to fetch course enrollments')
  }

  return {
    enrollments: data || [],
    pagination: paginationMeta(count || 0, page, limit)
  }
}

export async function updateEnrollmentStatus(supabase, enrollmentId, updates, adminId) {
  // Fetch current enrollment
  const { data: enrollment, error: fetchError } = await supabase
    .from('enrollments')
    .select('id, student_id, course_id, package_id, status')
    .eq('id', enrollmentId)
    .single()

  if (fetchError || !enrollment) {
    throw new NotFoundError('Enrollment')
  }

  // Prevent updating already completed/cancelled enrollments
  if (['completed', 'cancelled'].includes(enrollment.status) && updates.status !== 'cancelled') {
    throw new BadRequestError(`Cannot update a ${enrollment.status} enrollment`)
  }

  const updateData = {
    status: updates.status,
    updated_at: new Date().toISOString()
  }

  if (updates.payment_status) {
    updateData.payment_status = updates.payment_status
  }

  // If approving, record who approved and when
  if (updates.status === 'approved') {
    updateData.approved_by = adminId
    updateData.approved_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('enrollments')
    .update(updateData)
    .eq('id', enrollmentId)
    .select('*')
    .single()

  if (error) {
    throw new BadRequestError('Failed to update enrollment')
  }

  // Grant course access on approval
  if (updates.status === 'approved') {
    await grantCourseAccess(supabase, enrollment)
  }

  // Revoke course access on rejection/cancellation
  if (['rejected', 'cancelled'].includes(updates.status)) {
    await revokeCourseAccess(supabase, enrollment)
  }

  return data
}

// ---- Course Access Management ----

async function grantCourseAccess(supabase, enrollment) {
  const { student_id, course_id, package_id, id: enrollment_id } = enrollment

  if (course_id) {
    // Direct course enrollment — grant access to single course
    await upsertAccess(supabase, student_id, course_id, 'direct_enrollment', enrollment_id)
  }

  if (package_id) {
    // Package enrollment — grant access to all courses in package
    const { data: items } = await supabase
      .from('course_package_items')
      .select('course_id')
      .eq('package_id', package_id)

    if (items && items.length > 0) {
      for (const item of items) {
        await upsertAccess(supabase, student_id, item.course_id, 'package', enrollment_id)
      }
    }
  }
}

async function revokeCourseAccess(supabase, enrollment) {
  const { student_id, id: enrollment_id } = enrollment

  await supabase
    .from('student_course_access')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('student_id', student_id)
    .eq('source_enrollment_id', enrollment_id)
}

async function upsertAccess(supabase, studentId, courseId, grantedBy, enrollmentId) {
  // Check if access already exists
  const { data: existing } = await supabase
    .from('student_course_access')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .eq('is_active', true)
    .maybeSingle()

  if (existing) return // Already has access

  await supabase
    .from('student_course_access')
    .insert({
      student_id: studentId,
      course_id: courseId,
      granted_by: grantedBy,
      source_enrollment_id: enrollmentId,
      is_active: true,
      created_at: new Date().toISOString()
    })
}
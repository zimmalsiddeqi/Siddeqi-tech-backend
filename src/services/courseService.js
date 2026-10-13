// ============================================
// Course Service — Business logic for courses
// ============================================

import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js'
import { generateSlug, paginate, paginationMeta, pickFields } from '../utils/helpers.js'

const COURSE_COLUMNS = `
  id, title, slug, short_description, full_description,
  banner_url, category, technologies, learning_objectives,
  prerequisites, curriculum, duration, delivery_modes,
  price, currency, is_featured, featured_order, status,
  seo_title, seo_description, created_by, created_at, updated_at
`

const COURSE_LIST_COLUMNS = `
  id, title, slug, short_description, banner_url, category,
  technologies, duration, delivery_modes, price, currency,
  is_featured, featured_order, status, created_at
`

// ---- Public ----

export async function listPublishedCourses(supabase, query = {}) {
  const { offset, limit, page } = paginate(query.page, query.per_page)

  let dbQuery = supabase
    .from('courses')
    .select(COURSE_LIST_COLUMNS, { count: 'exact' })
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.category) {
    dbQuery = dbQuery.eq('category', query.category)
  }

  if (query.search) {
    dbQuery = dbQuery.or(`title.ilike.%${query.search}%,short_description.ilike.%${query.search}%`)
  }

  const { data, count, error } = await dbQuery

  if (error) {
    throw new BadRequestError('Failed to fetch courses')
  }

  return {
    courses: data || [],
    pagination: paginationMeta(count || 0, page, limit)
  }
}

export async function getFeaturedCourses(supabase) {
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_LIST_COLUMNS)
    .eq('status', 'published')
    .eq('is_featured', true)
    .order('featured_order', { ascending: true, nullsFirst: false })
    .limit(10)

  if (error) {
    throw new BadRequestError('Failed to fetch featured courses')
  }

  return data || []
}

export async function getCourseBySlug(supabase, slug) {
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error || !data) {
    throw new NotFoundError('Course')
  }

  return data
}

// ---- Admin ----

export async function listAllCourses(supabase, query = {}) {
  const { offset, limit, page } = paginate(query.page, query.per_page)

  let dbQuery = supabase
    .from('courses')
    .select(COURSE_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status)
  }

  if (query.category) {
    dbQuery = dbQuery.eq('category', query.category)
  }

  if (query.search) {
    dbQuery = dbQuery.or(`title.ilike.%${query.search}%,short_description.ilike.%${query.search}%`)
  }

  const { data, count, error } = await dbQuery

  if (error) {
    throw new BadRequestError('Failed to fetch courses')
  }

  return {
    courses: data || [],
    pagination: paginationMeta(count || 0, page, limit)
  }
}

export async function createCourse(supabase, courseData, adminId) {
  const slug = generateSlug(courseData.title)

  const newCourse = {
    ...courseData,
    slug,
    created_by: adminId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('courses')
    .insert(newCourse)
    .select(COURSE_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new ConflictError('A course with this title already exists')
    }
    throw new BadRequestError(`Failed to create course: ${error.message}`)
  }

  return data
}

export async function updateCourse(supabase, courseId, updates) {
  // If title is being updated, regenerate slug
  if (updates.title) {
    updates.slug = generateSlug(updates.title)
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', courseId)
    .select(COURSE_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new ConflictError('A course with this title already exists')
    }
    throw new BadRequestError(`Failed to update course: ${error.message}`)
  }

  if (!data) {
    throw new NotFoundError('Course')
  }

  return data
}

export async function archiveCourse(supabase, courseId) {
  const { data, error } = await supabase
    .from('courses')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString()
    })
    .eq('id', courseId)
    .select('id, title, status')
    .single()

  if (error || !data) {
    throw new NotFoundError('Course')
  }

  return data
}
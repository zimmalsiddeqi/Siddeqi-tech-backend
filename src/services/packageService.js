// ============================================
// Package Service — Course bundles/packages
// ============================================

import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js'
import { generateSlug, paginate, paginationMeta } from '../utils/helpers.js'

const PACKAGE_COLUMNS = `
  id, name, slug, description, price, currency,
  is_featured, status, created_at, updated_at
`

export async function listPublishedPackages(supabase) {
  const { data, error } = await supabase
    .from('course_packages')
    .select(`
      ${PACKAGE_COLUMNS},
      course_package_items (
        course_id,
        courses (
          id, title, slug, short_description, banner_url, price, currency
        )
      )
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error) {
    throw new BadRequestError('Failed to fetch packages')
  }

  return data || []
}

export async function listAllPackages(supabase, query = {}) {
  const { offset, limit, page } = paginate(query.page, query.per_page)

  let dbQuery = supabase
    .from('course_packages')
    .select(`
      ${PACKAGE_COLUMNS},
      course_package_items (
        course_id,
        courses (
          id, title, slug, price
        )
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status)
  }

  const { data, count, error } = await dbQuery

  if (error) {
    throw new BadRequestError('Failed to fetch packages')
  }

  return {
    packages: data || [],
    pagination: paginationMeta(count || 0, page, limit)
  }
}

export async function createPackage(supabase, packageData) {
  const { course_ids, ...rest } = packageData
  const slug = generateSlug(rest.name)

  // Verify all course IDs exist
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id')
    .in('id', course_ids)

  if (coursesError || !courses || courses.length !== course_ids.length) {
    throw new BadRequestError('One or more course IDs are invalid')
  }

  // Insert package
  const { data: pkg, error: pkgError } = await supabase
    .from('course_packages')
    .insert({
      ...rest,
      slug,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select(PACKAGE_COLUMNS)
    .single()

  if (pkgError) {
    if (pkgError.code === '23505') {
      throw new ConflictError('A package with this name already exists')
    }
    throw new BadRequestError(`Failed to create package: ${pkgError.message}`)
  }

  // Insert junction records
  const items = course_ids.map(courseId => ({
    package_id: pkg.id,
    course_id: courseId
  }))

  const { error: itemsError } = await supabase
    .from('course_package_items')
    .insert(items)

  if (itemsError) {
    // Rollback: delete the package if junction insert fails
    await supabase.from('course_packages').delete().eq('id', pkg.id)
    throw new BadRequestError('Failed to link courses to package')
  }

  return pkg
}

export async function updatePackage(supabase, packageId, updates) {
  const { course_ids, ...rest } = updates

  if (rest.name) {
    rest.slug = generateSlug(rest.name)
  }

  rest.updated_at = new Date().toISOString()

  // Update package
  const { data: pkg, error } = await supabase
    .from('course_packages')
    .update(rest)
    .eq('id', packageId)
    .select(PACKAGE_COLUMNS)
    .single()

  if (error || !pkg) {
    throw new NotFoundError('Package')
  }

  // Update course links if provided
  if (course_ids && course_ids.length > 0) {
    // Verify courses exist
    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .in('id', course_ids)

    if (!courses || courses.length !== course_ids.length) {
      throw new BadRequestError('One or more course IDs are invalid')
    }

    // Delete old links
    await supabase
      .from('course_package_items')
      .delete()
      .eq('package_id', packageId)

    // Insert new links
    const items = course_ids.map(courseId => ({
      package_id: packageId,
      course_id: courseId
    }))

    const { error: itemsError } = await supabase
      .from('course_package_items')
      .insert(items)

    if (itemsError) {
      throw new BadRequestError('Failed to update course links')
    }
  }

  return pkg
}

export async function deletePackage(supabase, packageId) {
  // Delete junction records first
  await supabase
    .from('course_package_items')
    .delete()
    .eq('package_id', packageId)

  const { data, error } = await supabase
    .from('course_packages')
    .delete()
    .eq('id', packageId)
    .select('id, name')
    .single()

  if (error || !data) {
    throw new NotFoundError('Package')
  }

  return data
}
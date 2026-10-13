// ============================================
// Admin Student Routes
// ============================================

import { paginate, paginationMeta, successResponse, whatsappLink } from '../../utils/helpers.js'
import { BadRequestError, NotFoundError } from '../../utils/errors.js'

export default async function adminStudentRoutes(fastify) {

  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply)
    await fastify.requireAdmin(request, reply)
  })

  // GET /api/admin/students — List all students
  fastify.get('/api/admin/students', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          per_page: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string', maxLength: 200 },
          is_active: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { offset, limit, page } = paginate(request.query.page, request.query.per_page)

    let query = fastify.supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, whatsapp, role, is_active, created_at', { count: 'exact' })
      .eq('role', 'student')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (request.query.search) {
      query = query.or(`full_name.ilike.%${request.query.search}%,email.ilike.%${request.query.search}%`)
    }

    if (request.query.is_active !== undefined) {
      query = query.eq('is_active', request.query.is_active)
    }

    const { data, count, error } = await query

    if (error) {
      throw new BadRequestError('Failed to fetch students')
    }

    // Add WhatsApp links
    const students = (data || []).map(student => ({
      ...student,
      whatsapp_link: whatsappLink(student.whatsapp)
    }))

    return reply.send(successResponse(students, paginationMeta(count || 0, page, limit)))
  })

  // GET /api/admin/students/:id — Single student details with enrollments
  fastify.get('/api/admin/students/:id', async (request, reply) => {
    const { data: student, error } = await fastify.supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, whatsapp, role, is_active, created_at')
      .eq('id', request.params.id)
      .eq('role', 'student')
      .single()

    if (error || !student) {
      throw new NotFoundError('Student')
    }

    // Get enrollments
    const { data: enrollments } = await fastify.supabase
      .from('enrollments')
      .select(`
        id, status, payment_status, amount, currency, created_at,
        courses:course_id (id, title, slug),
        course_packages:package_id (id, name)
      `)
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })

    // Get course access
    const { data: access } = await fastify.supabase
      .from('student_course_access')
      .select(`
        id, granted_by, is_active, created_at,
        courses:course_id (id, title, slug)
      `)
      .eq('student_id', student.id)

    return reply.send(successResponse({
      ...student,
      whatsapp_link: whatsappLink(student.whatsapp),
      enrollments: enrollments || [],
      course_access: access || []
    }))
  })

  // PATCH /api/admin/students/:id/status — Activate/deactivate student
  fastify.patch('/api/admin/students/:id/status', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } }
      },
      body: {
        type: 'object',
        required: ['is_active'],
        properties: { is_active: { type: 'boolean' } },
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { data, error } = await fastify.supabase
      .from('profiles')
      .update({
        is_active: request.body.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', request.params.id)
      .eq('role', 'student')
      .select('id, full_name, is_active')
      .single()

    if (error || !data) {
      throw new NotFoundError('Student')
    }

    return reply.send(successResponse(data))
  })
}
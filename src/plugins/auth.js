// ============================================
// Authentication & Authorization Plugin
// Validates Supabase JWT tokens and attaches user to request
// ============================================

import fp from 'fastify-plugin'
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js'

async function authPlugin(fastify) {
  /**
   * Decorator: authenticate
   * Extracts and validates the Supabase access token
   * Attaches user profile to request.user
   */
  fastify.decorate('authenticate', async function (request, reply) {
    const authHeader = request.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header')
    }

    const token = authHeader.split(' ')[1]

    if (!token) {
      throw new UnauthorizedError('Missing access token')
    }

    // Verify token with Supabase — this is always fresh and catches revoked sessions
    const { data: { user }, error } = await fastify.supabase.auth.getUser(token)

    if (error || !user) {
      throw new UnauthorizedError('Invalid or expired token')
    }

    // Fetch user profile with role
    const { data: profile, error: profileError } = await fastify.supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, whatsapp, role, is_active')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new UnauthorizedError('User profile not found')
    }

    if (!profile.is_active) {
      throw new ForbiddenError('Account has been deactivated')
    }

    // Attach full user context to request
    request.user = {
      id: user.id,
      email: user.email,
      ...profile
    }
  })

  /**
   * Decorator: requireAdmin
   * Must be used AFTER authenticate
   * Ensures the user has admin or instructor role
   */
  fastify.decorate('requireAdmin', async function (request, reply) {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required')
    }

    const allowedRoles = ['admin', 'instructor']

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError('Administrator access required')
    }
  })

  /**
   * Decorator: requireStudent
   * Must be used AFTER authenticate
   * Ensures the user has student role (or admin viewing as student)
   */
  fastify.decorate('requireStudent', async function (request, reply) {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required')
    }

    const allowedRoles = ['student', 'admin', 'instructor']

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError('Access denied')
    }
  })

  fastify.log.info('Authentication plugin loaded')
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['supabase']
})
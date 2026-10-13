// ============================================
// Supabase Client Plugin
// Two clients: one for user-context, one for admin/service operations
// ============================================

import fp from 'fastify-plugin'
import { createClient } from '@supabase/supabase-js'

async function supabasePlugin(fastify) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error('Missing required Supabase environment variables')
  }

  // Service-role client — bypasses RLS
  // Use ONLY for admin operations and trusted server-side logic
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Anon client — respects RLS
  // Used when we want database-level security enforcement
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Decorate fastify instance so all routes can access these
  fastify.decorate('supabase', serviceClient)
  fastify.decorate('supabaseAnon', anonClient)

  fastify.log.info('Supabase clients initialized')
}

export default fp(supabasePlugin, {
  name: 'supabase'
})
// ============================================
// Profile Service — Business logic for user profiles
// ============================================

import { NotFoundError, BadRequestError } from '../utils/errors.js'
import { pickFields } from '../utils/helpers.js'

const UPDATABLE_FIELDS = ['full_name', 'whatsapp', 'avatar_url']

export async function getProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, whatsapp, role, is_active, created_at')
    .eq('id', userId)
    .single()

  if (error || !data) {
    throw new NotFoundError('Profile')
  }

  return data
}

export async function updateProfile(supabase, userId, updates) {
  const safeUpdates = pickFields(updates, UPDATABLE_FIELDS)

  if (Object.keys(safeUpdates).length === 0) {
    throw new BadRequestError('No valid fields to update')
  }

  safeUpdates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('profiles')
    .update(safeUpdates)
    .eq('id', userId)
    .select('id, full_name, email, avatar_url, whatsapp, role, is_active, created_at')
    .single()

  if (error) {
    throw new BadRequestError('Failed to update profile')
  }

  return data
}
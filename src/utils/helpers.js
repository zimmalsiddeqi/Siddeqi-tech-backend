// ============================================
// Shared Utility Functions
// ============================================

import slugify from 'slugify'
import { nanoid } from 'nanoid'

/**
 * Generate a URL-friendly slug from text
 * Appends a short unique suffix to prevent collisions
 */
export function generateSlug(text) {
  const base = slugify(text, {
    lower: true,
    strict: true,
    trim: true
  })
  const suffix = nanoid(6)
  return `${base}-${suffix}`
}

/**
 * Generate a unique room ID for LiveKit
 */
export function generateRoomId() {
  return `class-${nanoid(12)}`
}

/**
 * Normalize a phone number to international WhatsApp format
 * Handles Pakistani numbers: 03XX → +923XX
 */
export function normalizeWhatsApp(phone) {
  if (!phone) return null

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '')

  // Handle Pakistani format: 03XXXXXXXXX → 923XXXXXXXXX
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '92' + cleaned.slice(1)
  }

  // Ensure it starts with country code
  if (!cleaned.startsWith('92') && cleaned.length === 10) {
    cleaned = '92' + cleaned
  }

  return '+' + cleaned
}

/**
 * Generate a WhatsApp click-to-chat URL
 */
export function whatsappLink(phone, message = '') {
  const normalized = normalizeWhatsApp(phone)
  if (!normalized) return null

  const encoded = encodeURIComponent(message)
  return `https://wa.me/${normalized.replace('+', '')}${message ? `?text=${encoded}` : ''}`
}

/**
 * Paginate query results
 * Returns { offset, limit } for SQL queries
 */
export function paginate(page = 1, perPage = 20) {
  const safePage = Math.max(1, parseInt(page) || 1)
  const safeLimit = Math.min(100, Math.max(1, parseInt(perPage) || 20))
  const offset = (safePage - 1) * safeLimit

  return { offset, limit: safeLimit, page: safePage }
}

/**
 * Build pagination metadata for API responses
 */
export function paginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit)

  return {
    total,
    page,
    per_page: limit,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1
  }
}

/**
 * Format a consistent API success response
 */
export function successResponse(data, meta = null) {
  const response = {
    success: true,
    data
  }
  if (meta) {
    response.meta = meta
  }
  return response
}

/**
 * Pick only allowed fields from an object
 * Prevents mass-assignment vulnerabilities
 */
export function pickFields(obj, allowedFields) {
  const picked = {}
  for (const field of allowedFields) {
    if (obj[field] !== undefined) {
      picked[field] = obj[field]
    }
  }
  return picked
}

/**
 * Check if a string is a valid UUID v4
 */
export function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Convert UTC timestamp to a display-friendly format
 * Actual timezone conversion happens on the frontend
 */
export function formatTimestamp(date) {
  if (!date) return null
  return new Date(date).toISOString()
}
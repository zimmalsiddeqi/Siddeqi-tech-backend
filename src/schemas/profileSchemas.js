// ============================================
// Profile Validation Schemas
// ============================================

export const getProfileSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            full_name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            avatar_url: { type: ['string', 'null'] },
            whatsapp: { type: ['string', 'null'] },
            role: { type: 'string' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string' }
          }
        }
      }
    }
  }
}

export const updateProfileSchema = {
  body: {
    type: 'object',
    properties: {
      full_name: { type: 'string', minLength: 1, maxLength: 100 },
      whatsapp: { type: ['string', 'null'], maxLength: 30 },
      avatar_url: { type: ['string', 'null'], maxLength: 2048 }
    },
    additionalProperties: false
  }
}
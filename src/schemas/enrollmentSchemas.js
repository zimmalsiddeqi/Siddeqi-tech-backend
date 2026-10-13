// ============================================
// Enrollment Validation Schemas
// ============================================

export const createEnrollmentSchema = {
  body: {
    type: 'object',
    properties: {
      course_id: { type: 'string', format: 'uuid' },
      package_id: { type: 'string', format: 'uuid' }
    },
    // At least one must be provided — validated in service layer
    additionalProperties: false
  }
}

export const updateEnrollmentSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' }
    }
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['approved', 'rejected', 'cancelled']
      },
      payment_status: {
        type: 'string',
        enum: ['not_required', 'pending', 'paid', 'failed', 'refunded']
      }
    },
    additionalProperties: false
  }
}

export const listEnrollmentsSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      per_page: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'] },
      payment_status: { type: 'string', enum: ['not_required', 'pending', 'paid', 'failed', 'refunded'] },
      course_id: { type: 'string', format: 'uuid' },
      search: { type: 'string', maxLength: 200 }
    }
  }
}

export const courseEnrollmentsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' }
    }
  },
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      per_page: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'] }
    }
  }
}
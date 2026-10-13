// ============================================
// Recording Validation Schemas
// ============================================

export const recordingParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' }
    }
  }
}

export const publishRecordingSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' }
    }
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 300 },
      description: { type: 'string', maxLength: 2000 },
      lesson_order: { type: 'integer', minimum: 0 },
      allow_download: { type: 'boolean', default: false }
    },
    additionalProperties: false
  }
}

export const listRecordingsSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      per_page: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      course_id: { type: 'string', format: 'uuid' },
      publication_status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      processing_status: { type: 'string', enum: ['not_started', 'starting', 'recording', 'processing', 'ready', 'failed'] }
    }
  }
}

export const playbackAccessSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' }
    }
  }
}
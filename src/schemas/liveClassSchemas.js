// ============================================
// Live Class Validation Schemas
// ============================================

export const createLiveClassSchema = {
  body: {
    type: 'object',
    required: ['course_id', 'title', 'scheduled_start', 'scheduled_end'],
    properties: {
      course_id: { type: 'string', format: 'uuid' },
      title: { type: 'string', minLength: 3, maxLength: 300 },
      description: { type: 'string', maxLength: 2000 },
      scheduled_start: { type: 'string', format: 'date-time' },
      scheduled_end: { type: 'string', format: 'date-time' },
      timezone: { type: 'string', maxLength: 50, default: 'Asia/Karachi' },
      recording_enabled: { type: 'boolean', default: true },
      chat_enabled: { type: 'boolean', default: true },
      max_participants: { type: 'integer', minimum: 1, maximum: 1000, default: 100 }
    },
    additionalProperties: false
  }
}

export const updateLiveClassSchema = {
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
      scheduled_start: { type: 'string', format: 'date-time' },
      scheduled_end: { type: 'string', format: 'date-time' },
      timezone: { type: 'string', maxLength: 50 },
      recording_enabled: { type: 'boolean' },
      chat_enabled: { type: 'boolean' },
      max_participants: { type: 'integer', minimum: 1, maximum: 1000 }
    },
    additionalProperties: false
  }
}

export const liveClassParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' }
    }
  }
}

export const listLiveClassesSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      per_page: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      status: { type: 'string', enum: ['scheduled', 'live', 'completed', 'cancelled'] },
      course_id: { type: 'string', format: 'uuid' }
    }
  }
}
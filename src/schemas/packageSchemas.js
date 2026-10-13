// ============================================
// Package Validation Schemas
// ============================================

export const createPackageSchema = {
  body: {
    type: 'object',
    required: ['name', 'description', 'price', 'course_ids'],
    properties: {
      name: { type: 'string', minLength: 3, maxLength: 200 },
      description: { type: 'string', minLength: 10, maxLength: 2000 },
      price: { type: 'number', minimum: 0 },
      currency: { type: 'string', maxLength: 10, default: 'PKR' },
      is_featured: { type: 'boolean', default: false },
      status: { type: 'string', enum: ['draft', 'published', 'archived'], default: 'draft' },
      course_ids: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        minItems: 1,
        maxItems: 20
      }
    },
    additionalProperties: false
  }
}

export const updatePackageSchema = {
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
      name: { type: 'string', minLength: 3, maxLength: 200 },
      description: { type: 'string', minLength: 10, maxLength: 2000 },
      price: { type: 'number', minimum: 0 },
      currency: { type: 'string', maxLength: 10 },
      is_featured: { type: 'boolean' },
      status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      course_ids: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        minItems: 1,
        maxItems: 20
      }
    },
    additionalProperties: false
  }
}

export const listPackagesSchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      page: { type: 'integer', minimum: 1, default: 1 },
      per_page: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
    }
  }
}
// ============================================
// Course Validation Schemas
// ============================================

// Shared course properties for responses
const courseProperties = {
  id: { type: 'string', format: 'uuid' },
  title: { type: 'string' },
  slug: { type: 'string' },
  short_description: { type: 'string' },
  full_description: { type: ['string', 'null'] },
  banner_url: { type: ['string', 'null'] },
  category: { type: ['string', 'null'] },
  technologies: { type: 'array', items: { type: 'string' } },
  learning_objectives: {},
  prerequisites: {},
  curriculum: {},
  duration: { type: ['string', 'null'] },
  delivery_modes: { type: 'array', items: { type: 'string' } },
  price: { type: 'number' },
  currency: { type: 'string' },
  is_featured: { type: 'boolean' },
  featured_order: { type: ['integer', 'null'] },
  status: { type: 'string' },
  seo_title: { type: ['string', 'null'] },
  seo_description: { type: ['string', 'null'] },
  created_by: { type: ['string', 'null'] },
  created_at: { type: 'string' },
  updated_at: { type: 'string' }
}

export const listCoursesSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      per_page: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      category: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      search: { type: 'string', maxLength: 200 }
    }
  }
}

export const getCourseBySlugSchema = {
  params: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: { type: 'string', minLength: 1 }
    }
  }
}

export const createCourseSchema = {
  body: {
    type: 'object',
    required: ['title', 'short_description', 'price'],
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 200 },
      short_description: { type: 'string', minLength: 10, maxLength: 500 },
      full_description: { type: 'string', maxLength: 10000 },
      banner_url: { type: 'string', maxLength: 500 },
      category: { type: 'string', maxLength: 100 },
      technologies: {
        type: 'array',
        items: { type: 'string', maxLength: 50 },
        maxItems: 20,
        default: []
      },
      learning_objectives: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' }
          }
        },
        default: []
      },
      prerequisites: {
        type: 'array',
        items: { type: 'string' },
        default: []
      },
      curriculum: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section_title: { type: 'string' },
            lessons: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  duration: { type: 'string' },
                  type: { type: 'string', enum: ['video', 'live', 'assignment', 'quiz'] }
                }
              }
            }
          }
        },
        default: []
      },
      duration: { type: 'string', maxLength: 50 },
      delivery_modes: {
        type: 'array',
        items: { type: 'string', enum: ['live', 'recorded', 'hybrid'] },
        default: ['live']
      },
      price: { type: 'number', minimum: 0 },
      currency: { type: 'string', maxLength: 10, default: 'PKR' },
      is_featured: { type: 'boolean', default: false },
      featured_order: { type: 'integer', minimum: 0 },
      status: { type: 'string', enum: ['draft', 'published', 'archived'], default: 'draft' },
      seo_title: { type: 'string', maxLength: 200 },
      seo_description: { type: 'string', maxLength: 500 }
    },
    additionalProperties: false
  }
}

export const updateCourseSchema = {
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
      title: { type: 'string', minLength: 3, maxLength: 200 },
      short_description: { type: 'string', minLength: 10, maxLength: 500 },
      full_description: { type: 'string', maxLength: 10000 },
      banner_url: { type: 'string', maxLength: 500 },
      category: { type: 'string', maxLength: 100 },
      technologies: {
        type: 'array',
        items: { type: 'string', maxLength: 50 },
        maxItems: 20
      },
      learning_objectives: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' }
          }
        }
      },
      prerequisites: {
        type: 'array',
        items: { type: 'string' }
      },
      curriculum: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section_title: { type: 'string' },
            lessons: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  duration: { type: 'string' },
                  type: { type: 'string', enum: ['video', 'live', 'assignment', 'quiz'] }
                }
              }
            }
          }
        }
      },
      duration: { type: 'string', maxLength: 50 },
      delivery_modes: {
        type: 'array',
        items: { type: 'string', enum: ['live', 'recorded', 'hybrid'] }
      },
      price: { type: 'number', minimum: 0 },
      currency: { type: 'string', maxLength: 10 },
      is_featured: { type: 'boolean' },
      featured_order: { type: 'integer', minimum: 0 },
      status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      seo_title: { type: 'string', maxLength: 200 },
      seo_description: { type: 'string', maxLength: 500 }
    },
    additionalProperties: false
  }
}

export const deleteCourseSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' }
    }
  }
}
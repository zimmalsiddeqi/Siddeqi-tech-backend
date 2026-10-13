// ============================================
// Rate Limiting Plugin
// ============================================

import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'

async function rateLimitPlugin(fastify) {
  await fastify.register(rateLimit, {
    max: 100,             // 100 requests
    timeWindow: '1 minute', // per minute
    keyGenerator: (request) => {
      // Use authenticated user ID if available, otherwise IP
      return request.user?.id || request.ip
    },
    errorResponseBuilder: () => {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down.'
        }
      }
    }
  })

  fastify.log.info('Rate limiting configured')
}

export default fp(rateLimitPlugin, {
  name: 'rateLimit'
})
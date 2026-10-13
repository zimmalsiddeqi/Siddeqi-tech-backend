// ============================================
// CORS Configuration Plugin
// ============================================

import fp from 'fastify-plugin'
import cors from '@fastify/cors'

async function corsPlugin(fastify) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  const isProduction = process.env.NODE_ENV === 'production'

  await fastify.register(cors, {
    origin: isProduction
      ? [clientUrl]
      : [clientUrl, 'http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // Cache preflight for 24 hours
  })

  fastify.log.info(`CORS configured for origin: ${clientUrl}`)
}

export default fp(corsPlugin, {
  name: 'cors'
})
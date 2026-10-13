// ============================================
// CORS Configuration Plugin
// ============================================

import fp from 'fastify-plugin'
import cors from '@fastify/cors'

async function corsPlugin(fastify) {
  const configuredOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean)

  const allowedOrigins = [
    'https://shawkattech.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    ...configuredOrigins
  ]

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return cb(null, true)

      // Exact match
      if (allowedOrigins.includes(origin)) return cb(null, true)

      // Allow any Vercel deployment preview (*.vercel.app)
      try {
        const url = new URL(origin)
        if (url.hostname.endsWith('.vercel.app') || url.hostname.endsWith('.railway.app') || url.hostname === 'localhost') {
          return cb(null, true)
        }
      } catch (e) {
        return cb(null, false)
      }

      cb(null, false)
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // Cache preflight for 24 hours
  })

  fastify.log.info(`CORS configured for origins: ${allowedOrigins.join(', ')} and *.vercel.app`)
}

export default fp(corsPlugin, {
  name: 'cors'
})
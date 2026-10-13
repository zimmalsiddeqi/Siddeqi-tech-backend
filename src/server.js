// ============================================
// Shawkat Siddeqi Tech LMS — Fastify Server
// ============================================

import 'dotenv/config'
import Fastify from 'fastify'
import formbody from '@fastify/formbody'
import multipart from '@fastify/multipart'
import { errorHandler } from './utils/errors.js'

// Plugins
import supabasePlugin from './plugins/supabase.js'
import corsPlugin from './plugins/cors.js'
import rateLimitPlugin from './plugins/rateLimit.js'
import authPlugin from './plugins/auth.js'

// Routes — Public
import publicCourseRoutes from './routes/public/courses.js'

// Routes — Student
import profileRoutes from './routes/student/profile.js'
import studentEnrollmentRoutes from './routes/student/enrollments.js'
import studentLiveClassRoutes from './routes/student/liveClasses.js'
import studentRecordingRoutes from './routes/student/recordings.js'

// Routes — Admin
import adminCourseRoutes from './routes/admin/courses.js'
import adminPackageRoutes from './routes/admin/packages.js'
import adminEnrollmentRoutes from './routes/admin/enrollments.js'
import adminStudentRoutes from './routes/admin/students.js'
import adminLiveClassRoutes from './routes/admin/liveClasses.js'
import adminRecordingRoutes from './routes/admin/recordings.js'

// Routes — Webhooks
import livekitWebhookRoutes from './routes/webhooks/livekit.js'

// Routes — Uploads
import uploadRoutes from './routes/upload.js'

// ---- Initialize Fastify ----
const isProduction = process.env.NODE_ENV === 'production'

const fastify = Fastify({
  logger: isProduction 
    ? { level: 'info' } 
    : {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      },
  trustProxy: true,
  bodyLimit: 10 * 1024 * 1024 // 10MB max body
})

// ---- Global Error Handler ----
fastify.setErrorHandler(errorHandler)

// ---- Content-Type Parsers ----
// 1. Parse application/json gracefully (allow empty bodies as {})
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  if (!body || body.trim().length === 0) {
    return done(null, {})
  }
  try {
    const json = JSON.parse(body)
    done(null, json)
  } catch (err) {
    err.statusCode = 400
    done(err, undefined)
  }
})

// 2. Parse application/webhook+json as raw string for LiveKit Webhook HMAC verification
fastify.addContentTypeParser('application/webhook+json', { parseAs: 'string' }, (req, body, done) => {
  done(null, body)
})

// ---- Register Plugins ----
await fastify.register(formbody)
await fastify.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file upload
  }
})

// Core plugins
await fastify.register(corsPlugin)
await fastify.register(rateLimitPlugin)
await fastify.register(supabasePlugin)
await fastify.register(authPlugin)

// ---- Register Routes ----

// Health check
fastify.get('/api/health', async () => {
  return {
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    }
  }
})

// Public routes
await fastify.register(publicCourseRoutes)

// Student routes
await fastify.register(profileRoutes)
await fastify.register(studentEnrollmentRoutes)
await fastify.register(studentLiveClassRoutes)
await fastify.register(studentRecordingRoutes)

// Admin routes
await fastify.register(adminCourseRoutes)
await fastify.register(adminPackageRoutes)
await fastify.register(adminEnrollmentRoutes)
await fastify.register(adminStudentRoutes)
await fastify.register(adminLiveClassRoutes)
await fastify.register(adminRecordingRoutes)

// Webhook routes
await fastify.register(livekitWebhookRoutes)

// Upload routes
await fastify.register(uploadRoutes)

// ---- Start Server ----
const PORT = parseInt(process.env.PORT) || 5000
const HOST = '0.0.0.0'

try {
  await fastify.listen({ port: PORT, host: HOST })
  fastify.log.info(`
  +----------------------------------------------+
  |   Shawkat Siddeqi Tech LMS Server            |
  |   Running on http://localhost:${PORT}        |
  |   Environment: ${process.env.NODE_ENV || 'development'}              |
  +----------------------------------------------+
  `)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM']
for (const signal of signals) {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`)
    await fastify.close()
    process.exit(0)
  })
}
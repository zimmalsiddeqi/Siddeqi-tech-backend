// ============================================
// Admin Package Routes
// ============================================

import {
  listAllPackages,
  createPackage,
  updatePackage,
  deletePackage
} from '../../services/packageService.js'
import {
  listPackagesSchema,
  createPackageSchema,
  updatePackageSchema
} from '../../schemas/packageSchemas.js'
import { successResponse } from '../../utils/helpers.js'
import { publicCache } from '../../utils/cache.js'

export default async function adminPackageRoutes(fastify) {

  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply)
    await fastify.requireAdmin(request, reply)
  })

  // GET /api/admin/packages
  fastify.get('/api/admin/packages', {
    schema: listPackagesSchema
  }, async (request, reply) => {
    const result = await listAllPackages(fastify.supabase, request.query)
    return reply.send(successResponse(result.packages, result.pagination))
  })

  // POST /api/admin/packages
  fastify.post('/api/admin/packages', {
    schema: createPackageSchema
  }, async (request, reply) => {
    const pkg = await createPackage(fastify.supabase, request.body)
    publicCache.clear()
    return reply.status(201).send(successResponse(pkg))
  })

  // PATCH /api/admin/packages/:id
  fastify.patch('/api/admin/packages/:id', {
    schema: updatePackageSchema
  }, async (request, reply) => {
    const pkg = await updatePackage(fastify.supabase, request.params.id, request.body)
    publicCache.clear()
    return reply.send(successResponse(pkg))
  })

  // DELETE /api/admin/packages/:id
  fastify.delete('/api/admin/packages/:id', async (request, reply) => {
    const pkg = await deletePackage(fastify.supabase, request.params.id)
    publicCache.clear()
    return reply.send(successResponse(pkg))
  })
}
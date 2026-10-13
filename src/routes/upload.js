// ============================================
// File Upload Routes (Images for Banners & Avatars)
// ============================================

import { BadRequestError } from '../utils/errors.js'
import { successResponse } from '../utils/helpers.js'
import { nanoid } from 'nanoid'

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
]

const EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg'
}

export default async function uploadRoutes(fastify) {
  fastify.post('/api/upload', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const data = await request.file()

    if (!data) {
      throw new BadRequestError('No file uploaded')
    }

    if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
      throw new BadRequestError(
        `Invalid file format (${data.mimetype}). Allowed formats: JPG, PNG, WebP, GIF, SVG`
      )
    }

    const buffer = await data.toBuffer()

    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestError('File size exceeds the 5MB limit')
    }

    // Determine target folder: 'banners', 'avatars', or 'general'
    const folderField = data.fields?.folder?.value
    const folder = ['banners', 'avatars'].includes(folderField) ? folderField : 'general'

    const ext = EXTENSION_MAP[data.mimetype] || 'jpg'
    const filename = `${folder}/${nanoid()}.${ext}`

    const { error: uploadError } = await fastify.supabase.storage
      .from('uploads')
      .upload(filename, buffer, {
        contentType: data.mimetype,
        upsert: true
      })

    if (uploadError) {
      fastify.log.error(uploadError, '[UPLOAD] Supabase storage upload failed')
      throw new BadRequestError(`Upload failed: ${uploadError.message}`)
    }

    const { data: publicData } = fastify.supabase.storage
      .from('uploads')
      .getPublicUrl(filename)

    return reply.status(201).send(successResponse({
      url: publicData.publicUrl,
      path: filename,
      mimetype: data.mimetype,
      size: buffer.length
    }))
  })
}

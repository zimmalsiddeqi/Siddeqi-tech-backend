// ============================================
// LiveKit Service — Token generation & room management
// ============================================

import {
  AccessToken,
  RoomServiceClient,
  EgressClient,
  EncodedFileType,
  EncodedFileOutput,
  S3Upload
} from 'livekit-server-sdk'
import { BadRequestError } from '../utils/errors.js'

const LIVEKIT_URL = process.env.LIVEKIT_URL
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET

function getHttpUrl() {
  if (!LIVEKIT_URL) {
    throw new BadRequestError('LIVEKIT_URL is not set in server/.env')
  }
  return LIVEKIT_URL
    .replace('wss://', 'https://')
    .replace('ws://', 'http://')
}

function getRoomService() {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new BadRequestError('LiveKit credentials missing in server/.env')
  }
  return new RoomServiceClient(getHttpUrl(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
}

export function getEgressClient() {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new BadRequestError('LiveKit credentials missing in server/.env')
  }
  return new EgressClient(getHttpUrl(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
}

/**
 * Generate a LiveKit access token for a participant
 */
export async function generateToken(roomId, userId, userName, isInstructor = false) {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new BadRequestError('LiveKit API Key/Secret is not configured in server/.env')
  }

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: String(userId || 'user'),
    name: String(userName || (isInstructor ? 'Instructor' : 'Student')),
    ttl: '6h'
  })

  token.addGrant({
    room: String(roomId),
    roomJoin: true,
    canPublish: Boolean(isInstructor),
    canSubscribe: true,
    canPublishData: true
  })

  return await token.toJwt()
}

/**
 * Create a LiveKit room gracefully
 */
export async function createRoom(roomId, maxParticipants = 100) {
  try {
    const service = getRoomService()
    return await service.createRoom({
      name: String(roomId),
      maxParticipants,
      emptyTimeout: 300
    })
  } catch (error) {
    console.warn(`[LIVEKIT] Note on room ${roomId}:`, error.message)
    return { name: roomId }
  }
}

/**
 * Close/delete a LiveKit room
 */
export async function deleteRoom(roomId) {
  try {
    const service = getRoomService()
    await service.deleteRoom(String(roomId))
  } catch (error) {
    console.warn(`[LIVEKIT] Failed to delete room ${roomId}:`, error.message)
  }
}

/**
 * List participants in a room
 */
export async function listParticipants(roomId) {
  try {
    const service = getRoomService()
    return await service.listParticipants(String(roomId))
  } catch (error) {
    return []
  }
}

/**
 * Start room composite recording via LiveKit Egress
 */
export async function startRecording(roomId) {
  const s3Endpoint = process.env.SUPABASE_S3_ENDPOINT
  const s3AccessKey = process.env.SUPABASE_S3_ACCESS_KEY
  const s3SecretKey = process.env.SUPABASE_S3_SECRET_KEY
  const s3Bucket = process.env.SUPABASE_S3_BUCKET || 'recordings'
  const s3Region = process.env.SUPABASE_S3_REGION || 'us-east-1'

  // Validate credentials exist
  if (!s3Endpoint || !s3AccessKey || !s3SecretKey) {
    throw new BadRequestError(
      'Recording storage is not configured. Add SUPABASE_S3_ENDPOINT, SUPABASE_S3_ACCESS_KEY, and SUPABASE_S3_SECRET_KEY to server/.env'
    )
  }

  // Ensure room exists on LiveKit Cloud (revives it if idle timeout closed it)
  await createRoom(roomId, 100)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filepath = `${roomId}/${timestamp}.mp4`

  const egressClient = getEgressClient()

  try {
    // Build S3 configuration
    const s3 = new S3Upload({
      accessKey: s3AccessKey.trim(),
      secret: s3SecretKey.trim(),
      region: s3Region.trim(),
      endpoint: s3Endpoint.trim(),
      bucket: s3Bucket.trim(),
      forcePathStyle: true
    })

    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: filepath,
      disableManifest: true,
      output: {
        case: 's3',
        value: s3
      }
    })

    console.log(`[EGRESS] Starting composite egress on room "${roomId}" -> "${filepath}"`)

    // Call LiveKit Egress
    const info = await egressClient.startRoomCompositeEgress(
      String(roomId),
      fileOutput,
      {
        layout: 'speaker',
        audioOnly: false
      }
    )

    console.log('[EGRESS] Success! EgressId:', info.egressId)

    return {
      egress_id: info.egressId,
      status: 'recording',
      filepath: filepath
    }
  } catch (error) {
    console.error('[EGRESS] LiveKit Egress Error Details:', error)
    
    // Provide human-friendly explanations for common LiveKit errors
    const errorMsg = error.message || ''
    if (errorMsg.includes('room') && (errorMsg.includes('not found') || errorMsg.includes('empty') || errorMsg.includes('no active'))) {
      throw new BadRequestError(
        'Cannot record an empty room. Please enter the classroom with your mic/camera or screen share enabled first!'
      )
    }

    throw new BadRequestError(`LiveKit Egress: ${errorMsg}`)
  }
}

/**
 * Stop a recording
 */
export async function stopRecording(egressId) {
  if (!egressId) {
    return { status: 'no_egress_id' }
  }

  const egressClient = getEgressClient()

  try {
    await egressClient.stopEgress(String(egressId))
    console.log('[EGRESS] Recording stopped for EgressId:', egressId)
    return { status: 'stopping' }
  } catch (error) {
    const msg = error.message || ''
    // If the egress already ended, failed, or was stopped, treat it as gracefully handled
    if (msg.includes('already') || msg.includes('not active') || msg.includes('not found') || msg.includes('ended') || msg.includes('completed')) {
      console.warn('[EGRESS] Egress already ended on LiveKit Cloud:', egressId, msg)
      return { status: 'already_stopped' }
    }
    console.error('[EGRESS] Stop error:', error)
    throw new BadRequestError(`Failed to stop recording: ${msg}`)
  }
}
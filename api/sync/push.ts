import type { VercelRequest, VercelResponse } from '@vercel/node'
import { redisFromEnv } from '../_redis.js'

const PAIR_CODE_REGEX = /^[a-z0-9]{16,40}$/
const MAX_BLOB_BYTES = 1_000_000  // 1MB
const TTL_SECONDS = 60 * 60 * 24 * 90  // 90 天

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code, version, updatedAt, data } = req.body as {
    code?: string
    version?: number
    updatedAt?: string
    data?: Record<string, string>
  }

  if (typeof code !== 'string' || !PAIR_CODE_REGEX.test(code))
    return res.status(400).json({ error: 'Invalid code' })
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    return res.status(400).json({ error: 'Invalid version' })
  if (typeof updatedAt !== 'string' || isNaN(Date.parse(updatedAt)))
    return res.status(400).json({ error: 'Invalid updatedAt' })
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return res.status(400).json({ error: 'Invalid data' })

  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('asset-tracker:') || typeof v !== 'string') {
      return res.status(400).json({ error: `Invalid entry: ${k}` })
    }
  }

  const blob = { version, updatedAt, data }
  const serialized = JSON.stringify(blob)
  if (serialized.length > MAX_BLOB_BYTES)
    return res.status(413).json({ error: 'Payload too large' })

  const redis = redisFromEnv()
  await redis.set(`sync:${code}`, blob, { ex: TTL_SECONDS })
  return res.status(200).json({ ok: true, updatedAt })
}

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { redisFromEnv } from '../_redis.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { endpoint } = req.body as { endpoint?: string }
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' })

  const redis = redisFromEnv()
  const key = createHash('sha256').update(endpoint).digest('hex').slice(0, 16)
  await redis.hdel('push:subs', key)
  return res.status(200).json({ ok: true })
}

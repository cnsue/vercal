import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'
import { createHash } from 'node:crypto'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { endpoint } = req.body as { endpoint?: string }
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' })

  const redis = Redis.fromEnv()
  const key = createHash('sha256').update(endpoint).digest('hex').slice(0, 16)
  await redis.hdel('push:subs', key)
  return res.status(200).json({ ok: true })
}

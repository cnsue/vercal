import type { VercelRequest, VercelResponse } from '@vercel/node'
import { redisFromEnv } from '../_redis.js'

const PAIR_CODE_REGEX = /^[a-z0-9]{16,40}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const code = typeof req.query.code === 'string' ? req.query.code : ''
  if (!PAIR_CODE_REGEX.test(code)) return res.status(400).json({ error: 'Invalid code' })

  const redis = redisFromEnv()
  const blob = await redis.get(`sync:${code}`)
  if (!blob) return res.status(404).json({ error: 'Not found' })
  return res.status(200).json(blob)
}

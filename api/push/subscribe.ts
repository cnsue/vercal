import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { redisFromEnv } from '../_redis.js'
import type { ReminderFrequency } from '../../src/types/push.js'

interface PushSub {
  endpoint: string
  keys: { auth: string; p256dh: string }
}

export interface StoredSubscription {
  subscription: PushSub
  frequency: ReminderFrequency
  createdAt: string
  lastSentAt: string | null
}

function subKey(endpoint: string) {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 16)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { subscription, frequency = 'daily' } = req.body as {
    subscription?: PushSub
    frequency?: ReminderFrequency
  }
  if (!subscription?.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh)
    return res.status(400).json({ error: 'Invalid subscription' })
  if (!['daily', 'weekly', 'off'].includes(frequency as string))
    return res.status(400).json({ error: 'Invalid frequency' })

  const redis = redisFromEnv()
  const key = subKey(subscription.endpoint)
  const existing = await redis.hget<StoredSubscription>('push:subs', key)
  const record: StoredSubscription = {
    subscription,
    frequency,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    lastSentAt: existing?.lastSentAt ?? null,
  }
  await redis.hset('push:subs', { [key]: record })
  return res.status(200).json({ ok: true })
}

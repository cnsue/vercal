import type { VercelRequest, VercelResponse } from '@vercel/node'
import webpush from 'web-push'
import { redisFromEnv } from './_redis.js'
import type { StoredSubscription } from './push/subscribe.js'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`)
    return res.status(401).json({ error: 'Unauthorized' })

  const redis = redisFromEnv()
  const allSubs = await redis.hgetall<Record<string, StoredSubscription>>('push:subs')
  if (!allSubs) return res.status(200).json({ sent: 0, skipped: 0, removed: 0 })

  const payload = JSON.stringify({
    title: 'Coinsight 提醒',
    body: '今天还没有记录资产快照，来记录一下吧 💰',
  })

  const now = Date.now()
  let sent = 0
  let skipped = 0
  const toRemove: string[] = []
  const toUpdate: Record<string, StoredSubscription> = {}

  for (const [key, record] of Object.entries(allSubs)) {
    if (record.frequency === 'off') { skipped++; continue }
    if (
      record.frequency === 'weekly' &&
      record.lastSentAt &&
      now - new Date(record.lastSentAt).getTime() < SEVEN_DAYS_MS
    ) {
      skipped++; continue
    }

    try {
      await webpush.sendNotification(record.subscription as webpush.PushSubscription, payload)
      toUpdate[key] = { ...record, lastSentAt: new Date().toISOString() }
      sent++
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 410 || status === 404) toRemove.push(key)
    }
  }

  if (Object.keys(toUpdate).length > 0) await redis.hset('push:subs', toUpdate)
  if (toRemove.length > 0) await redis.hdel('push:subs', ...toRemove)

  return res.status(200).json({ sent, skipped, removed: toRemove.length })
}

import { Redis } from '@upstash/redis'

export function redisFromEnv(): Redis {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
}
